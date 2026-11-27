// ─────────────────────────────────────────────────────────────────────────────
// AI providers the parts agent can run on. Safe to import anywhere: nothing here
// holds a key. Keys live encrypted in public.ai_provider_keys (server only).
// ─────────────────────────────────────────────────────────────────────────────

export const AI_PROVIDERS = ["claude", "gemini", "openai", "qwen"] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

export const isAiProvider = (v: unknown): v is AiProvider =>
	typeof v === "string" && (AI_PROVIDERS as readonly string[]).includes(v);

type ProviderInfo = {
	label: string;
	company: string;
	/** Where an admin gets a key. */
	keysUrl: string;
	/** Fixed API address, or the default one when the address can be changed. */
	defaultBaseUrl: string;
	/** Regional addresses to pick from, when the provider has them. */
	regions?: { label: string; value: string }[];
};

export const PROVIDER_INFO: Record<AiProvider, ProviderInfo> = {
	claude: {
		label: "Claude",
		company: "Anthropic",
		keysUrl: "https://console.anthropic.com/settings/keys",
		defaultBaseUrl: "https://api.anthropic.com/v1",
	},
	gemini: {
		label: "Gemini",
		company: "Google",
		keysUrl: "https://aistudio.google.com/app/apikey",
		defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
	},
	openai: {
		label: "ChatGPT",
		company: "OpenAI",
		keysUrl: "https://platform.openai.com/api-keys",
		defaultBaseUrl: "https://api.openai.com/v1",
	},
	qwen: {
		label: "Qwen",
		company: "Alibaba Cloud",
		keysUrl: "https://modelstudio.console.alibabacloud.com/",
		defaultBaseUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
		regions: [
			{
				label: "International (Singapore)",
				value: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
			},
			{
				label: "Mainland China (Beijing)",
				value: "https://dashscope.aliyuncs.com/compatible-mode/v1",
			},
		],
	},
};

export type AiModel = { id: string; label: string };

/**
 * Models the parts agent can use: only ones that read images, since it works
 * from photos. Text-only models (e.g. OpenAI's o3-mini, Qwen's text models)
 * and image models with no JSON-friendly chat API (e.g. qvq, OCR-only models)
 * are left out. Add new models here as providers release them; the settings
 * page and the server both check against this list. The first is suggested.
 */
export const VISION_MODELS: Record<AiProvider, AiModel[]> = {
	claude: [
		{ id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5 · balanced (suggested)" },
		{ id: "claude-opus-5-5", label: "Claude Opus 5.5 · most capable, slower, costs more" },
		{ id: "claude-fable-5-2", label: "Claude Fable 5.2" },
		{ id: "claude-haiku-5-5", label: "Claude Haiku 5.5 · fastest, lowest cost" },
	],
	// Gemini 3.8 Live (audio out only) and the TTS models (text in only) can't do this job
	gemini: [
		{ id: "gemini-4-hydrogen", label: "Gemini 4 Hydrogen · everyday work (suggested)" },
		{ id: "gemini-4-carbon", label: "Gemini 4 Carbon · strongest reasoning" },
		{ id: "gemini-4-argon", label: "Gemini 4 Argon" },
		{ id: "gemini-4-neon", label: "Gemini 4 Neon" },
		{ id: "gemini-3.8-flash", label: "Gemini 3.8 Flash" },
	],
	// gpt-6-cyber is left out: it needs approval from OpenAI
	openai: [
		{ id: "gpt-6.2-astra", label: "GPT-6.2 Astra · flagship (suggested)" },
		{ id: "gpt-6.2-sol", label: "GPT-6.2 Sol" },
		{ id: "gpt-6.1-terra", label: "GPT-6.1 Terra · fast" },
		{ id: "gpt-6-luna", label: "GPT-6 Luna · lowest cost" },
		{ id: "gpt-5", label: "GPT-5" },
		{ id: "gpt-5.1", label: "GPT-5.1" },
		{ id: "gpt-5-mini", label: "GPT-5 mini · faster, lower cost" },
	],
	// Qwen 3.8 Max and Flash read images themselves; qwen3.8-omni-flash is left out (streaming)
	qwen: [
		{ id: "qwen3.8-max", label: "Qwen 3.8 Max · most capable (suggested)" },
		{ id: "qwen3.8-flash", label: "Qwen 3.8 Flash · lower cost" },
		{ id: "qwen-vl-max", label: "Qwen-VL Max" },
		{ id: "qwen3-vl-plus", label: "Qwen3-VL Plus" },
		{ id: "qwen-vl-plus", label: "Qwen-VL Plus · lower cost" },
	],
};

/** The suggested model: first on the provider's list. */
export const defaultModel = (provider: AiProvider) => VISION_MODELS[provider][0].id;

export const isVisionModel = (provider: AiProvider, model: string) =>
	VISION_MODELS[provider].some((m) => m.id === model);

/** The model's name as listed, or its id. */
export const modelLabel = (provider: AiProvider, model: string) =>
	VISION_MODELS[provider].find((m) => m.id === model)?.label.split(" · ")[0] ?? model;

/** Where the agent's instructions start. The MD or GM can rewrite them. */
export const DEFAULT_AGENT_PROMPT = `You are the parts agent for a furniture workshop. From photos of a piece a client wants, list every part needed to build one piece, matched to the workshop's inventory, and estimate the production labour.

Be careful and conservative:
- Use only SKUs from the inventory list. When nothing in inventory fits, give the part a clear name and set its SKU to null.
- Count from what you can see. When something isn't visible (springs, inner frame, webbing), still list it if the piece needs it, lower your confidence and say why.
- Quantities are per piece, in the unit the inventory uses.
- Prefer the materials and finishes the description asks for over what the photo shows.`;

export const AI_LIMITS = {
	temperature: { min: 0, max: 1, default: 0.2 },
	maxOutputTokens: { min: 1024, max: 32000, default: 8192 },
	prompt: 8000,
	context: 8000,
} as const;

/** One provider as the settings page sees it: never the key itself. */
export type AiProviderView = {
	provider: AiProvider;
	model: string;
	baseUrl: string;
	hasKey: boolean;
	/** Last 4 characters of the saved key, to tell keys apart. */
	keyLast4: string | null;
	updatedAt: string | null;
};

export type AiSettingsView = {
	defaultProvider: AiProvider;
	prompt: string;
	context: string;
	temperature: number;
	maxOutputTokens: number;
	providers: AiProviderView[];
	/** The server can encrypt keys (AI_KEYS_SECRET is set). */
	canStoreKeys: boolean;
};

/** "Claude (claude-sonnet-5-5)". */
export const providerLabel = (p: Pick<AiProviderView, "provider" | "model">) =>
	`${PROVIDER_INFO[p.provider].label} (${p.model})`;
