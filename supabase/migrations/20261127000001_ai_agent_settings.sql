-- ============================================================================
-- AI settings for the custom design parts agent
--
-- ai_agent_settings: one row: which provider runs the agent, its instructions
--   (prompt), workshop context, temperature and output limit.
-- ai_provider_keys: one row per provider: model, API address and the API key,
--   encrypted by the app (AES-256-GCM under AI_KEYS_SECRET) before it's stored.
--
-- Neither table is readable or writable by signed-in users directly: the app
-- reads and writes them with the service role, after checking the person's role
-- and, for every change, their password and a two-step code.
-- ============================================================================

create table public.ai_agent_settings (
	id smallint primary key default 1 check (id = 1),
	default_provider text not null default 'claude'
		check (default_provider in ('claude', 'gemini', 'openai', 'qwen')),
	prompt text not null default '' check (char_length(prompt) <= 8000),
	context text not null default '' check (char_length(context) <= 8000),
	temperature numeric(3, 2) not null default 0.2 check (temperature between 0 and 1),
	max_output_tokens integer not null default 8192
		check (max_output_tokens between 1024 and 32000),
	updated_by uuid references auth.users (id) on delete set null,
	updated_at timestamptz not null default now()
);

comment on table public.ai_agent_settings is
	'Which AI provider runs the custom design parts agent, and its instructions. Service role only.';

insert into public.ai_agent_settings (id) values (1) on conflict (id) do nothing;

create table public.ai_provider_keys (
	provider text primary key check (provider in ('claude', 'gemini', 'openai', 'qwen')),
	model text not null check (char_length(model) between 1 and 120),
	base_url text check (base_url is null or base_url like 'https://%'),
	-- "v1:<base64 iv|tag|ciphertext>", never the plain key
	api_key_encrypted text,
	key_last4 text check (key_last4 is null or char_length(key_last4) <= 4),
	updated_by uuid references auth.users (id) on delete set null,
	updated_at timestamptz not null default now()
);

comment on table public.ai_provider_keys is
	'Model, API address and encrypted API key per AI provider. Service role only.';

create index ai_agent_settings_updated_by_idx on public.ai_agent_settings (updated_by);
create index ai_provider_keys_updated_by_idx on public.ai_provider_keys (updated_by);

insert into public.ai_provider_keys (provider, model, base_url) values
	('claude', 'claude-sonnet-5-5', null),
	('gemini', 'gemini-4-hydrogen', null),
	('openai', 'gpt-5', null),
	('qwen', 'qwen-vl-max', 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1')
on conflict (provider) do nothing;

-- Service role only: RLS on with no policies, and no grants to app roles.
revoke all on public.ai_agent_settings from anon, authenticated;
revoke all on public.ai_provider_keys from anon, authenticated;
alter table public.ai_agent_settings enable row level security;
alter table public.ai_provider_keys enable row level security;
