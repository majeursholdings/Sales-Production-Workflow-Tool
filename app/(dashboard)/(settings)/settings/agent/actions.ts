"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, userWith, type ActionResult } from "@/lib/actionResult";
import { canEncrypt, encryptSecret } from "@/lib/ai/secretBox";
import {
	AI_LIMITS,
	AI_PROVIDERS,
	PROVIDER_INFO,
	isVisionModel,
	type AiProvider,
	type AiProviderView,
} from "@/lib/aiProviders";
import { getAiRuntime, getAiSettingsView } from "@/lib/data/aiSettings";
import { testAiProvider } from "@/lib/partsAgent";
import { confirmIdentity, type StepUpProof } from "@/lib/stepUp";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";

const NO_ACCESS = "Only the MD or GM can change the AI settings.";

const modelName = z.string().trim().min(1, "Pick a model").max(120);

/** Only image-reading models from the list can be saved or tested. */
const checkModel = (provider: AiProvider, model: string, ctx: z.RefinementCtx, path: string[]) => {
	if (!isVisionModel(provider, model)) {
		ctx.addIssue({
			code: "custom",
			path,
			message: `${PROVIDER_INFO[provider].label} model "${model}" isn't on the list of models that can read photos.`,
		});
	}
};

/** Only the provider's own addresses, so a key can never be sent anywhere else. */
function allowedBaseUrl(provider: AiProvider, url: string | undefined) {
	const info = PROVIDER_INFO[provider];
	if (!info.regions) return null;
	return info.regions.some((r) => r.value === url) ? url! : info.defaultBaseUrl;
}

const providerSchema = z.object({
	model: modelName,
	baseUrl: z.string().trim().optional(),
	apiKey: z.string().trim().max(500, "That API key is too long").default(""),
	removeKey: z.boolean().default(false),
});

const aiSchema = z
	.object({
		defaultProvider: z.enum(AI_PROVIDERS),
		prompt: z
			.string()
			.trim()
			.min(40, "The prompt is too short to guide the agent")
			.max(AI_LIMITS.prompt, `Keep the prompt under ${AI_LIMITS.prompt} characters`),
		context: z
			.string()
			.trim()
			.max(AI_LIMITS.context, `Keep the context under ${AI_LIMITS.context} characters`)
			.default(""),
		temperature: z.coerce.number().min(0).max(1),
		maxOutputTokens: z.coerce
			.number()
			.int("Enter a whole number")
			.min(AI_LIMITS.maxOutputTokens.min, `At least ${AI_LIMITS.maxOutputTokens.min}`)
			.max(AI_LIMITS.maxOutputTokens.max, `At most ${AI_LIMITS.maxOutputTokens.max}`),
		providers: z.object({
			claude: providerSchema,
			gemini: providerSchema,
			openai: providerSchema,
			qwen: providerSchema,
		}),
	})
	.superRefine((v, ctx) => {
		for (const p of AI_PROVIDERS)
			checkModel(p, v.providers[p].model, ctx, ["providers", p, "model"]);
	});

export type SaveAiSettings = z.input<typeof aiSchema>;

/** What changed, in words, for Recent changes. Never mentions a key's value. */
function describeChanges(
	before: Awaited<ReturnType<typeof getAiSettingsView>>,
	v: z.output<typeof aiSchema>,
) {
	const out: string[] = [];
	const name = (p: AiProvider) => PROVIDER_INFO[p].label;
	if (v.defaultProvider !== before.defaultProvider) {
		out.push(`Switched the parts agent to ${name(v.defaultProvider)}`);
	}
	for (const p of AI_PROVIDERS) {
		const was = before.providers.find((x) => x.provider === p) as AiProviderView;
		const now = v.providers[p];
		if (now.apiKey) out.push(`${was.hasKey ? "Replaced" : "Added"} the ${name(p)} API key`);
		else if (now.removeKey && was.hasKey) out.push(`Removed the ${name(p)} API key`);
		if (now.model !== was.model) out.push(`Set the ${name(p)} model to ${now.model}`);
		const url = allowedBaseUrl(p, now.baseUrl);
		if (url && url !== was.baseUrl) out.push(`Moved ${name(p)} to another region`);
	}
	if (v.prompt !== before.prompt) out.push("Changed the agent's prompt");
	if (v.context !== before.context) out.push("Changed the workshop context");
	if (v.temperature !== before.temperature) out.push(`Set temperature to ${v.temperature}`);
	if (v.maxOutputTokens !== before.maxOutputTokens) {
		out.push(`Set the output limit to ${v.maxOutputTokens} tokens`);
	}
	return out;
}

/**
 * Saves the AI provider, keys and instructions. Needs the MD or GM's password
 * and a fresh two-step code every time. Keys are encrypted before they're stored.
 */
export async function saveAiSettingsAction(
	raw: SaveAiSettings,
	proof: StepUpProof,
): Promise<ActionResult> {
	const actor = await userWith("settings.company");
	if (!actor) return fail(NO_ACCESS);
	const parsed = aiSchema.safeParse(raw);
	if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the form.");
	const v = parsed.data;

	const who = await confirmIdentity(proof);
	if (!who.ok) return who;

	const newKeys = AI_PROVIDERS.filter((p) => v.providers[p].apiKey);
	if (newKeys.length && !canEncrypt()) {
		return fail(
			"The server can't store API keys yet. Set AI_KEYS_SECRET (32+ random characters) in its environment, restart it, then save again.",
		);
	}

	const before = await getAiSettingsView();
	const keyAfter = (p: AiProvider) =>
		!!v.providers[p].apiKey ||
		(before.providers.find((x) => x.provider === p)!.hasKey && !v.providers[p].removeKey);
	if (!keyAfter(v.defaultProvider)) {
		return fail(
			`Add an API key for ${PROVIDER_INFO[v.defaultProvider].label} before making it the default.`,
		);
	}

	const changes = describeChanges(before, v);
	if (changes.length === 0) return fail("Nothing has changed.");

	const admin = createAdminClient();
	const now = new Date().toISOString();
	const { error: settingsError } = await admin
		.from("ai_agent_settings")
		.update({
			default_provider: v.defaultProvider,
			prompt: v.prompt,
			context: v.context,
			temperature: v.temperature,
			max_output_tokens: v.maxOutputTokens,
			updated_by: actor.id,
			updated_at: now,
		})
		.eq("id", 1);
	if (settingsError) return fail(settingsError.message);

	for (const p of AI_PROVIDERS) {
		const input = v.providers[p];
		const keyPatch = input.apiKey
			? { api_key_encrypted: encryptSecret(input.apiKey), key_last4: input.apiKey.slice(-4) }
			: input.removeKey
				? { api_key_encrypted: null, key_last4: null }
				: {};
		const { error } = await admin.from("ai_provider_keys").upsert({
			provider: p,
			model: input.model,
			base_url: allowedBaseUrl(p, input.baseUrl),
			...keyPatch,
			updated_by: actor.id,
			updated_at: now,
		});
		if (error) return fail(error.message);
	}

	const supabase = await createClient();
	await Promise.all([
		supabase.from("company_settings_changes").insert({
			section: "agent",
			summary: changes.join("; "),
			actor_id: actor.id,
			actor_label: actor.name,
		}),
		supabase.from("audit_logs").insert({
			actor_id: actor.id,
			action: "settings.ai_changed",
			entity_type: "ai_agent_settings",
			entity_id: "1",
			old_values: {
				default_provider: before.defaultProvider,
				models: Object.fromEntries(before.providers.map((p) => [p.provider, p.model])),
			},
			new_values: {
				default_provider: v.defaultProvider,
				models: Object.fromEntries(AI_PROVIDERS.map((p) => [p, v.providers[p].model])),
				keys_changed: AI_PROVIDERS.filter(
					(p) => v.providers[p].apiKey || v.providers[p].removeKey,
				),
				confirmed_with: proof.method,
			},
		}),
	]);

	revalidatePath("/settings", "layout");
	revalidatePath("/furniture-types/custom-design");
	return { ok: true };
}

const testSchema = z
	.object({
		provider: z.enum(AI_PROVIDERS),
		model: modelName,
		baseUrl: z.string().trim().optional(),
		/** A key typed but not saved yet; blank tests the saved key. */
		apiKey: z.string().trim().max(500).default(""),
	})
	.superRefine((v, ctx) => checkModel(v.provider, v.model, ctx, ["model"]));

/** Checks a provider answers with the saved key (or one just typed). Changes nothing. */
export async function testAiProviderAction(raw: z.input<typeof testSchema>): Promise<ActionResult> {
	const actor = await userWith("settings.company");
	if (!actor) return fail(NO_ACCESS);
	const parsed = testSchema.safeParse(raw);
	if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the form.");
	const { provider, model, baseUrl, apiKey } = parsed.data;

	const saved = await getAiRuntime(provider);
	if (!apiKey && !saved.ok) return saved;
	const base = saved.ok
		? saved.runtime
		: {
				provider,
				prompt: "",
				context: "",
				temperature: AI_LIMITS.temperature.default,
				maxOutputTokens: AI_LIMITS.maxOutputTokens.default,
			};
	return testAiProvider({
		...base,
		provider,
		model,
		baseUrl: allowedBaseUrl(provider, baseUrl) ?? PROVIDER_INFO[provider].defaultBaseUrl,
		apiKey: apiKey || (saved.ok ? saved.runtime.apiKey : ""),
	});
}
