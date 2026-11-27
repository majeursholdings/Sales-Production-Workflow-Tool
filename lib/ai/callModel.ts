import { PROVIDER_INFO, type AiProvider } from "@/lib/aiProviders";
import type { AiRuntime } from "@/lib/data/aiSettings";

/*
 * One call to whichever provider the MD or GM picked: Claude (Messages API),
 * Gemini (generateContent), ChatGPT and Qwen (OpenAI-style chat completions).
 * Plain fetch, no SDKs. Server only: it carries the decrypted key.
 */

export type ModelImage = { mime: string; base64: string };

export type ModelRequest = {
	system: string;
	text: string;
	images: ModelImage[];
	/** Ask for a JSON object back, where the provider supports a JSON mode. */
	json?: boolean;
	/** Overrides the saved output limit, e.g. for a connection test. */
	maxOutputTokens?: number;
	timeoutMs?: number;
};

export type ModelResult =
	| { ok: true; text: string }
	/** `code` is set when the provider answered but the reply can't be used. */
	| { ok: false; message: string; code?: "cut" | "empty" };

type Call = { url: string; headers: Record<string, string>; body: unknown };

const trimSlash = (url: string) => url.replace(/\/+$/, "");

/** Reasoning models (GPT-5 and later, o-series) take only the default temperature. */
const fixedTemperature = (model: string) => /^(gpt-([5-9]|\d{2,})|o\d)/i.test(model);

function buildCall(rt: AiRuntime, req: ModelRequest): Call {
	const maxTokens = req.maxOutputTokens ?? rt.maxOutputTokens;
	const base = trimSlash(rt.baseUrl);

	switch (rt.provider) {
		case "claude":
			return {
				url: `${base}/messages`,
				headers: { "x-api-key": rt.apiKey, "anthropic-version": "2023-06-01" },
				body: {
					model: rt.model,
					max_tokens: maxTokens,
					temperature: rt.temperature,
					system: req.system,
					messages: [
						{
							role: "user",
							content: [
								...req.images.map((img) => ({
									type: "image",
									source: {
										type: "base64",
										media_type: img.mime,
										data: img.base64,
									},
								})),
								{ type: "text", text: req.text },
							],
						},
					],
				},
			};

		case "gemini":
			return {
				url: `${base}/models/${encodeURIComponent(rt.model)}:generateContent`,
				headers: { "x-goog-api-key": rt.apiKey },
				body: {
					systemInstruction: { parts: [{ text: req.system }] },
					contents: [
						{
							role: "user",
							parts: [
								...req.images.map((img) => ({
									inlineData: { mimeType: img.mime, data: img.base64 },
								})),
								{ text: req.text },
							],
						},
					],
					generationConfig: {
						temperature: rt.temperature,
						maxOutputTokens: maxTokens,
						...(req.json ? { responseMimeType: "application/json" } : {}),
					},
				},
			};

		case "openai":
		case "qwen": {
			const openai = rt.provider === "openai";
			return {
				url: `${base}/chat/completions`,
				headers: { Authorization: `Bearer ${rt.apiKey}` },
				body: {
					model: rt.model,
					messages: [
						{ role: "system", content: req.system },
						{
							role: "user",
							content: [
								{ type: "text", text: req.text },
								...req.images.map((img) => ({
									type: "image_url",
									image_url: { url: `data:${img.mime};base64,${img.base64}` },
								})),
							],
						},
					],
					...(openai
						? { max_completion_tokens: maxTokens }
						: { max_tokens: Math.min(maxTokens, 8192) }),
					...(openai && fixedTemperature(rt.model)
						? {}
						: { temperature: rt.temperature }),
					...(openai && req.json ? { response_format: { type: "json_object" } } : {}),
				},
			};
		}
	}
}

type Json = Record<string, unknown>;

/** The reply's text, or why there's none. */
function readReply(provider: AiProvider, data: Json): ModelResult {
	const cut = {
		ok: false as const,
		code: "cut" as const,
		message: "The reply was cut off. Raise the output limit in Settings › Custom design agent.",
	};
	const empty = {
		ok: false as const,
		code: "empty" as const,
		message: "The model sent an empty reply.",
	};
	if (provider === "claude") {
		const content = (data.content as { type: string; text?: string }[] | undefined) ?? [];
		if (data.stop_reason === "max_tokens") return cut;
		const text = content
			.filter((c) => c.type === "text")
			.map((c) => c.text ?? "")
			.join("");
		return text ? { ok: true, text } : empty;
	}
	if (provider === "gemini") {
		const blocked = (data.promptFeedback as Json | undefined)?.blockReason;
		if (blocked)
			return { ok: false, message: `Gemini refused the request (${String(blocked)}).` };
		const candidate = (data.candidates as Json[] | undefined)?.[0];
		if (candidate?.finishReason === "MAX_TOKENS") return cut;
		const parts =
			((candidate?.content as Json | undefined)?.parts as { text?: string }[]) ?? [];
		const text = parts.map((p) => p.text ?? "").join("");
		return text ? { ok: true, text } : empty;
	}
	const choice = (data.choices as Json[] | undefined)?.[0];
	if (choice?.finish_reason === "length") return cut;
	const text = (choice?.message as Json | undefined)?.content;
	return typeof text === "string" && text ? { ok: true, text } : empty;
}

/** The provider's own error message, if it sent one. */
function errorDetail(data: unknown): string {
	if (!data || typeof data !== "object") return "";
	const err = (data as Json).error;
	if (typeof err === "string") return err;
	if (err && typeof err === "object" && typeof (err as Json).message === "string") {
		return (err as Json).message as string;
	}
	return typeof (data as Json).message === "string" ? ((data as Json).message as string) : "";
}

export async function callModel(rt: AiRuntime, req: ModelRequest): Promise<ModelResult> {
	const label = PROVIDER_INFO[rt.provider].label;
	const { url, headers, body } = buildCall(rt, req);

	let res: Response;
	try {
		res = await fetch(url, {
			method: "POST",
			headers: { "content-type": "application/json", ...headers },
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(req.timeoutMs ?? 120_000),
			cache: "no-store",
		});
	} catch (e) {
		const timedOut = e instanceof Error && e.name === "TimeoutError";
		return {
			ok: false,
			message: timedOut
				? `${label} took too long to answer. Try again, or use fewer photos.`
				: `Couldn't reach ${label}. Check the server's internet connection and the API address.`,
		};
	}

	const data = (await res.json().catch(() => null)) as Json | null;
	if (!res.ok) {
		const detail = errorDetail(data).slice(0, 300);
		const why =
			res.status === 401 || res.status === 403
				? `${label} refused the API key. Check it in Settings › Custom design agent.`
				: res.status === 404
					? `${label} doesn't know the model "${rt.model}". Check the model name in Settings › Custom design agent.`
					: res.status === 429
						? `${label} is rate-limiting this key or its credit has run out. Try again shortly.`
						: `${label} returned an error (${res.status}).`;
		return { ok: false, message: detail ? `${why} ${label} said: ${detail}` : why };
	}
	if (!data) return { ok: false, message: `${label} sent a reply that isn't JSON.` };
	return readReply(rt.provider, data);
}

/** The first JSON object in a reply, ignoring code fences and text around it. */
export function extractJson(text: string): unknown {
	const unfenced = text.replace(/```(?:json)?/gi, "");
	const start = unfenced.indexOf("{");
	const end = unfenced.lastIndexOf("}");
	if (start === -1 || end <= start) return null;
	try {
		return JSON.parse(unfenced.slice(start, end + 1));
	} catch {
		return null;
	}
}
