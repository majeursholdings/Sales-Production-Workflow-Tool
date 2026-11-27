import { canEncrypt, decryptSecret } from "@/lib/ai/secretBox";
import {
	AI_LIMITS,
	AI_PROVIDERS,
	DEFAULT_AGENT_PROMPT,
	PROVIDER_INFO,
	defaultModel,
	isAiProvider,
	isVisionModel,
	type AiProvider,
	type AiProviderView,
	type AiSettingsView,
} from "@/lib/aiProviders";
import { createAdminClient } from "@/utils/supabase/admin";

/*
 * AI settings are read with the service role (the tables have no RLS policies),
 * so callers check the person's role first. Only getAiRuntime() ever decrypts a key.
 */

type SettingsRow = {
	default_provider: string;
	prompt: string;
	context: string;
	temperature: number | string;
	max_output_tokens: number;
};

type KeyRow = {
	provider: string;
	model: string;
	base_url: string | null;
	api_key_encrypted: string | null;
	key_last4: string | null;
	updated_at: string | null;
};

async function loadRows(): Promise<{ settings: SettingsRow | null; keys: KeyRow[] }> {
	const admin = createAdminClient();
	const [settings, keys] = await Promise.all([
		admin
			.from("ai_agent_settings")
			.select("default_provider, prompt, context, temperature, max_output_tokens")
			.eq("id", 1)
			.maybeSingle(),
		admin
			.from("ai_provider_keys")
			.select("provider, model, base_url, api_key_encrypted, key_last4, updated_at"),
	]);
	if (settings.error) throw new Error(`Couldn't load AI settings: ${settings.error.message}`);
	if (keys.error) throw new Error(`Couldn't load AI providers: ${keys.error.message}`);
	return { settings: settings.data as SettingsRow | null, keys: (keys.data ?? []) as KeyRow[] };
}

const viewOf = (provider: AiProvider, row: KeyRow | undefined): AiProviderView => ({
	provider,
	// A model no longer on the list (or never on it) falls back to the suggested one
	model: row?.model && isVisionModel(provider, row.model) ? row.model : defaultModel(provider),
	baseUrl: row?.base_url || PROVIDER_INFO[provider].defaultBaseUrl,
	hasKey: !!row?.api_key_encrypted,
	keyLast4: row?.key_last4 ?? null,
	updatedAt: row?.updated_at ?? null,
});

function buildView(settings: SettingsRow | null, keys: KeyRow[]): AiSettingsView {
	const byProvider = new Map(keys.map((k) => [k.provider, k]));
	return {
		defaultProvider: isAiProvider(settings?.default_provider)
			? settings.default_provider
			: "claude",
		prompt: settings?.prompt || DEFAULT_AGENT_PROMPT,
		context: settings?.context ?? "",
		temperature: Number(settings?.temperature ?? AI_LIMITS.temperature.default),
		maxOutputTokens: Number(settings?.max_output_tokens ?? AI_LIMITS.maxOutputTokens.default),
		providers: AI_PROVIDERS.map((p) => viewOf(p, byProvider.get(p))),
		canStoreKeys: canEncrypt(),
	};
}

/** Everything the settings page shows. Never includes a key. */
export async function getAiSettingsView(): Promise<AiSettingsView> {
	const { settings, keys } = await loadRows();
	return buildView(settings, keys);
}

/** What a model call needs, with the key decrypted. */
export type AiRuntime = {
	provider: AiProvider;
	model: string;
	baseUrl: string;
	apiKey: string;
	prompt: string;
	context: string;
	temperature: number;
	maxOutputTokens: number;
};

export type AiRuntimeResult = { ok: true; runtime: AiRuntime } | { ok: false; message: string };

/** The default provider (or `provider`) ready to call, or why it can't be. */
export async function getAiRuntime(provider?: AiProvider): Promise<AiRuntimeResult> {
	const { settings, keys } = await loadRows();
	const view = buildView(settings, keys);
	const chosen = provider ?? view.defaultProvider;
	const row = keys.find((k) => k.provider === chosen);
	const label = PROVIDER_INFO[chosen].label;
	if (!row?.api_key_encrypted) {
		return {
			ok: false,
			message: `The parts agent isn't set up yet: ${label} has no API key. The MD or GM adds it in Settings › Custom design agent.`,
		};
	}
	const apiKey = decryptSecret(row.api_key_encrypted);
	if (!apiKey) {
		return {
			ok: false,
			message: `The saved ${label} API key can't be read (AI_KEYS_SECRET is missing or changed). The MD or GM needs to enter it again in Settings › Custom design agent.`,
		};
	}
	const p = view.providers.find((x) => x.provider === chosen)!;
	return {
		ok: true,
		runtime: {
			provider: chosen,
			model: p.model,
			baseUrl: p.baseUrl,
			apiKey,
			prompt: view.prompt,
			context: view.context,
			temperature: view.temperature,
			maxOutputTokens: view.maxOutputTokens,
		},
	};
}

/** Whether the default provider has a key, without decrypting it. */
export async function getAgentStatus(): Promise<{ ready: boolean; label: string }> {
	const view = await getAiSettingsView();
	const p = view.providers.find((x) => x.provider === view.defaultProvider)!;
	return {
		ready: p.hasKey && view.canStoreKeys,
		label: `${PROVIDER_INFO[p.provider].label} (${p.model})`,
	};
}
