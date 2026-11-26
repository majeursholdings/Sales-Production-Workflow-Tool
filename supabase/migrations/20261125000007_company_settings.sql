-- ============================================================================
-- Company settings: the singleton row behind Settings → Company, Bank & terms,
-- Numbering, Tax & currency, Trade program, Custom design agent and Email &
-- WhatsApp, plus the change history shown under "Recent changes".
--
-- Single source of truth: VAT, deposit, quote validity, the dollar rate, the
-- general discount and trade tiers already live in public.pricing_rules (the
-- Pricing page shows them). They stay there; this migration only adds the
-- columns pricing_rules was missing (dollar rounding, who sets the rate,
-- trade tiers as data, who can give the general discount). company_settings
-- holds everything else.
--
-- Read access: every active signed-in user can read company_settings. Quote
-- and invoice documents (sales, customer care, accounting) need the company
-- details, bank details, terms, numbering and sending messages; the quote
-- builder needs the agent rules; procurement needs the PO approval limit; the
-- sign-in policy applies to everyone. None of it is secret: bank details are
-- printed on every invoice. Only MD and GM (settings.company) can change it.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. company_settings (singleton)
-- ----------------------------------------------------------------------------
create table public.company_settings (
	id smallint primary key default 1 check (id = 1),

	-- Company details printed on every document
	logo_url text not null default '',
	trading_name text not null default '',
	registered_name text not null default '',
	rc_number text not null default '',
	tin text not null default '',
	address text not null default '',
	phone text not null default '',
	whatsapp text not null default '',
	website text not null default '',

	-- Sign-in policy for everyone
	require_two_step boolean not null default false,
	two_step_from date,
	idle_hours integer not null default 12 check (idle_hours in (4, 8, 12, 24)),

	-- Bank details for payment
	ngn_bank text not null default '',
	ngn_account_name text not null default '',
	ngn_account_number text not null default '' check (ngn_account_number ~ '^(\d{10})?$'),
	usd_bank text not null default '',
	usd_account_number text not null default '' check (usd_account_number ~ '^(\d{10})?$'),
	swift text not null default '' check (swift ~ '^([A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?)?$'),

	-- Terms on documents
	quote_terms text not null default '',
	invoice_footer text not null default '',

	-- Document number prefixes
	quote_prefix text not null default 'MAJ-QT-' check (quote_prefix ~ '^[A-Z0-9-]{1,12}-$'),
	invoice_prefix text not null default 'MAJ-INV-' check (invoice_prefix ~ '^[A-Z0-9-]{1,12}-$'),
	purchase_order_prefix text not null default 'MAJ-PO-' check (purchase_order_prefix ~ '^[A-Z0-9-]{1,12}-$'),
	job_card_prefix text not null default 'JC-' check (job_card_prefix ~ '^[A-Z0-9-]{1,12}-$'),
	cost_request_prefix text not null default 'CR-' check (cost_request_prefix ~ '^[A-Z0-9-]{1,12}-$'),

	-- Purchase orders over this need MD or GM approval
	po_approval_limit numeric(14, 2) not null default 1000000 check (po_approval_limit > 0),

	-- Custom design agent
	agent_threshold integer not null default 85 check (agent_threshold between 50 and 100),
	agent_direct_to_quote boolean not null default true,
	agent_low_stock_to_procurement boolean not null default false,
	agent_suggest_substitutes boolean not null default true,

	-- Email & WhatsApp
	from_email text not null default '',
	sender_name text not null default '',
	quote_email_message text not null default
		'Hi {client first name}, your quote {quote number} is attached and valid until {valid until}. Reply to this email with any questions. {prepared by}',
	whatsapp_message text not null default
		'Hi {client first name}, here''s your quote {quote number}: {link}. It''s valid until {valid until}.',
	cc_accounting_on_invoices boolean not null default true,

	updated_by uuid references auth.users (id) on delete set null,
	updated_at timestamptz not null default now(),

	-- Every document type needs its own prefix
	constraint company_settings_prefixes_distinct check (
		quote_prefix not in (invoice_prefix, purchase_order_prefix, job_card_prefix, cost_request_prefix)
		and invoice_prefix not in (purchase_order_prefix, job_card_prefix, cost_request_prefix)
		and purchase_order_prefix not in (job_card_prefix, cost_request_prefix)
		and job_card_prefix <> cost_request_prefix
	)
);

comment on table public.company_settings is
	'Singleton company settings: document details, bank details, terms, numbering, sign-in policy, PO approval limit, custom design agent rules and sending messages. Pricing values (VAT, deposit, validity, USD rate, discounts, trade tiers) live in pricing_rules.';

create index company_settings_updated_by_idx on public.company_settings (updated_by);

create trigger company_settings_set_updated_at
	before update on public.company_settings
	for each row execute function private.set_updated_at();

insert into public.company_settings (id)
values (1)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 2. company_settings_changes (append-only "Recent changes")
-- ----------------------------------------------------------------------------
create table public.company_settings_changes (
	id bigint generated always as identity primary key,
	section text not null check (
		section in ('company', 'sign_in', 'bank', 'terms', 'numbering', 'tax', 'dollar', 'trade', 'discount', 'agent', 'sending')
	),
	summary text not null,
	actor_id uuid references auth.users (id) on delete set null,
	actor_label text not null,
	created_at timestamptz not null default now()
);

comment on table public.company_settings_changes is
	'Who changed which company setting and when. Append-only.';

create index company_settings_changes_actor_id_idx on public.company_settings_changes (actor_id);
create index company_settings_changes_created_at_idx on public.company_settings_changes (created_at desc);

-- ----------------------------------------------------------------------------
-- 3. pricing_rules: the columns the settings pages need
-- ----------------------------------------------------------------------------
alter table public.pricing_rules
	add column if not exists usd_rounding text not null default '1'
		check (usd_rounding in ('1', '0.01', '5')),
	add column if not exists usd_rate_set_by uuid references auth.users (id) on delete set null,
	add column if not exists usd_rate_set_by_label text not null default '',
	add column if not exists usd_rate_set_at timestamptz,
	add column if not exists trade_tiers jsonb not null default
		'[{"name":"Silver","minSpend":20000000,"discountPercent":5},{"name":"Gold","minSpend":50000000,"discountPercent":10},{"name":"Platinum","minSpend":100000000,"discountPercent":20}]'::jsonb
		check (jsonb_typeof(trade_tiers) = 'array'),
	add column if not exists general_discount_who text not null default 'care-and-sales'
		check (general_discount_who in ('care-and-sales', 'sales', 'owners'));

comment on column public.pricing_rules.trade_tiers is
	'Trade program tiers, lowest first: [{name, minSpend (NGN paid in 365 days), discountPercent}]. trade_tiers_label is kept in sync from this.';
comment on column public.pricing_rules.usd_rounding is 'Rounding for dollar prices: 1, 0.01 or 5 dollars.';
comment on column public.pricing_rules.general_discount_who is 'Who can give the general discount: care-and-sales, sales or owners (MD/GM).';

create index if not exists pricing_rules_usd_rate_set_by_idx on public.pricing_rules (usd_rate_set_by);

-- Whoever changes the rate (Settings or Pricing page) is recorded, and the
-- trade tiers label the Pricing page shows always matches the tiers.
create or replace function private.pricing_rules_track_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	if new.usd_exchange_rate is distinct from old.usd_exchange_rate then
		new.usd_rate_set_at := now();
		new.usd_rate_set_by := auth.uid();
		new.usd_rate_set_by_label := coalesce(
			(select p.full_name from public.profiles p where p.id = auth.uid()),
			''
		);
	end if;
	if new.trade_tiers is distinct from old.trade_tiers then
		new.trade_tiers_label := coalesce(
			(
				select string_agg(trim(to_char((t ->> 'discountPercent')::numeric, 'FM999990.99'), '.'), ' / ' order by ord)
				from jsonb_array_elements(new.trade_tiers) with ordinality as e(t, ord)
			) || '%',
			''
		);
	end if;
	return new;
end;
$$;

revoke all on function private.pricing_rules_track_changes() from public, anon, authenticated;

create trigger pricing_rules_track_changes
	before update on public.pricing_rules
	for each row execute function private.pricing_rules_track_changes();

-- ----------------------------------------------------------------------------
-- 4. Document logo storage (public: logos are printed on documents)
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
	'company-assets',
	'company-assets',
	true,
	1048576,
	array['image/png', 'image/svg+xml', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

create policy "MD and GM can list company assets"
	on storage.objects for select to authenticated
	using (bucket_id = 'company-assets' and (select private.authorize('settings.company')));

create policy "MD and GM can upload company assets"
	on storage.objects for insert to authenticated
	with check (bucket_id = 'company-assets' and (select private.authorize('settings.company')));

create policy "MD and GM can update company assets"
	on storage.objects for update to authenticated
	using (bucket_id = 'company-assets' and (select private.authorize('settings.company')))
	with check (bucket_id = 'company-assets' and (select private.authorize('settings.company')));

create policy "MD and GM can delete company assets"
	on storage.objects for delete to authenticated
	using (bucket_id = 'company-assets' and (select private.authorize('settings.company')));

-- ----------------------------------------------------------------------------
-- 5. Grants & RLS
-- ----------------------------------------------------------------------------
revoke all on public.company_settings from anon;
revoke all on public.company_settings_changes from anon;

grant select, update on public.company_settings to authenticated;
grant select, insert on public.company_settings_changes to authenticated;

alter table public.company_settings enable row level security;
alter table public.company_settings_changes enable row level security;

create policy "Active users can read company settings"
	on public.company_settings for select to authenticated
	using ((select private.current_user_role()) is not null);

create policy "MD and GM can update company settings"
	on public.company_settings for update to authenticated
	using ((select private.authorize('settings.company')))
	with check ((select private.authorize('settings.company')));

-- History: MD/GM and Accounting (who sees the settings read-only) can read it.
create policy "Settings viewers can read company settings changes"
	on public.company_settings_changes for select to authenticated
	using (
		(select private.authorize('settings.company'))
		or (select private.authorize('audit_log.view'))
	);

-- Pricing editors (Accounting) may log dollar-rate changes; everything else is MD/GM.
create policy "Settings editors can log their own changes"
	on public.company_settings_changes for insert to authenticated
	with check (
		actor_id = (select auth.uid())
		and (
			(select private.authorize('settings.company'))
			or (section = 'dollar' and (select private.authorize('pricing_rules.edit')))
		)
	);
