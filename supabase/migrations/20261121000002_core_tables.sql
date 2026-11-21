-- ============================================================================
-- Core Business Tables: Staff, Cost Rates, Pricing & Margins, Clients, Quotes
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Staff members (payroll & hourly rates for labour and overhead)
-- ----------------------------------------------------------------------------
create table public.staff_members (
	id uuid primary key default gen_random_uuid(),
	full_name text not null,
	role text not null,
	team text not null check (team in ('Production', 'Non-production')),
	phone text not null default '',
	email text not null default '',
	hourly_rate numeric(12, 2) not null check (hourly_rate >= 0),
	hours_per_month numeric(6, 2) not null default 160 check (hours_per_month > 0),
	notes text not null default '',
	is_active boolean not null default true,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

comment on table public.staff_members is 'Workshop production and non-production staff with hourly payroll rates.';

create index staff_members_team_idx on public.staff_members (team) where is_active = true;

create trigger staff_members_set_updated_at
	before update on public.staff_members
	for each row execute function private.set_updated_at();

-- ----------------------------------------------------------------------------
-- 2. Cost rates: workshop overhead settings & standard cost items
-- ----------------------------------------------------------------------------
create table public.overhead_settings (
	id smallint primary key default 1 check (id = 1),
	rent_monthly numeric(14, 2) not null default 1200000 check (rent_monthly >= 0),
	power_monthly numeric(14, 2) not null default 650000 check (power_monthly >= 0),
	other_monthly numeric(14, 2) not null default 250000 check (other_monthly >= 0),
	hours_per_production_person numeric(6, 2) not null default 160 check (hours_per_production_person > 0),
	contingency_percent numeric(5, 2) not null default 5 check (contingency_percent >= 0 and contingency_percent <= 100),
	updated_by uuid references auth.users (id) on delete set null,
	updated_at timestamptz not null default now()
);

comment on table public.overhead_settings is 'Singleton workshop overhead inputs and quote contingency percentage.';

create index overhead_settings_updated_by_idx on public.overhead_settings (updated_by);

create trigger overhead_settings_set_updated_at
	before update on public.overhead_settings
	for each row execute function private.set_updated_at();

create table public.cost_items (
	id uuid primary key default gen_random_uuid(),
	name text not null,
	note text not null default '',
	cost_type text not null check (cost_type in ('Direct', 'Indirect')),
	charged_per text not null default 'Per piece',
	amount numeric(14, 2) not null default 0 check (amount >= 0),
	sort_order integer not null default 0,
	is_active boolean not null default true,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

comment on table public.cost_items is 'Standard direct and indirect cost items (wrapping, delivery, installation, etc.).';

create trigger cost_items_set_updated_at
	before update on public.cost_items
	for each row execute function private.set_updated_at();

-- ----------------------------------------------------------------------------
-- 3. Pricing & margins: markup categories, global quote rules, change history
-- ----------------------------------------------------------------------------
create table public.markup_categories (
	id text primary key,
	name text not null unique,
	furniture_types_count integer not null default 0 check (furniture_types_count >= 0),
	markup_percent numeric(5, 2) not null check (markup_percent >= 0),
	ceiling_percent numeric(5, 2) not null check (ceiling_percent >= 0),
	example_cost numeric(14, 2) not null default 0 check (example_cost >= 0),
	sort_order integer not null default 0,
	updated_at timestamptz not null default now(),
	constraint markup_within_ceiling check (markup_percent <= ceiling_percent)
);

comment on table public.markup_categories is 'Category markup percentages with hard ceiling enforcement.';

create trigger markup_categories_set_updated_at
	before update on public.markup_categories
	for each row execute function private.set_updated_at();

create table public.pricing_rules (
	id smallint primary key default 1 check (id = 1),
	vat_rate numeric(6, 4) not null default 0.0750 check (vat_rate >= 0 and vat_rate <= 1),
	deposit_rate numeric(6, 4) not null default 0.7000 check (deposit_rate >= 0 and deposit_rate <= 1),
	quote_validity_days integer not null default 7 check (quote_validity_days > 0),
	max_general_discount_percent numeric(5, 2) not null default 10 check (max_general_discount_percent >= 0 and max_general_discount_percent <= 100),
	trade_tiers_label text not null default '5 / 10 / 20%',
	usd_exchange_rate numeric(12, 2) not null default 1460.00 check (usd_exchange_rate > 0),
	updated_by uuid references auth.users (id) on delete set null,
	updated_at timestamptz not null default now()
);

comment on table public.pricing_rules is 'Singleton global pricing rules (VAT, deposit %, quote validity, discounts, USD rate).';

create index pricing_rules_updated_by_idx on public.pricing_rules (updated_by);

create trigger pricing_rules_set_updated_at
	before update on public.pricing_rules
	for each row execute function private.set_updated_at();

create table public.pricing_history (
	id bigint generated always as identity primary key,
	summary text not null,
	actor_id uuid references auth.users (id) on delete set null,
	actor_label text not null,
	created_at timestamptz not null default now()
);

comment on table public.pricing_history is 'Append-only log of markup, ceiling, and pricing rule changes.';

create index pricing_history_actor_id_idx on public.pricing_history (actor_id);
create index pricing_history_created_at_idx on public.pricing_history (created_at desc);

-- ----------------------------------------------------------------------------
-- 4. Clients
-- ----------------------------------------------------------------------------
create table public.clients (
	id uuid primary key default gen_random_uuid(),
	name text not null,
	phone text not null default '',
	phone_key text,
	email text not null default '',
	client_type text not null default 'Individual' check (client_type in ('Individual', 'Trade')),
	company text not null default '',
	location text not null default '',
	birthday text not null default '',
	preferred_contact text not null default 'WhatsApp',
	source text not null default 'Referral',
	source_detail text not null default '',
	trade_tier text not null default '',
	notes text not null default '',
	quotes_count integer not null default 0 check (quotes_count >= 0),
	total_spent numeric(14, 2) not null default 0 check (total_spent >= 0),
	last_activity_label text not null default 'No quotes yet',
	last_activity_at timestamptz not null default now(),
	created_by uuid references auth.users (id) on delete set null,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

comment on table public.clients is 'Individual and Trade clients that Majeurs quotes for.';

create index clients_phone_key_idx on public.clients (phone_key) where phone_key is not null;
create index clients_email_lower_idx on public.clients (lower(email)) where email <> '';
create index clients_created_by_idx on public.clients (created_by);
create index clients_last_activity_at_idx on public.clients (last_activity_at desc);

create trigger clients_set_updated_at
	before update on public.clients
	for each row execute function private.set_updated_at();

-- ----------------------------------------------------------------------------
-- 5. Quotes, Quote Versions, Quote Lines, Quote Activity
-- ----------------------------------------------------------------------------
create table public.quotes (
	id uuid primary key default gen_random_uuid(),
	quote_number text not null unique,
	client_id uuid references public.clients (id) on delete set null,
	client_name text not null,
	items_summary text not null default '',
	status text not null default 'draft' check (status in ('draft', 'sent', 'expiring', 'paid', 'expired', 'cancelled')),
	currency text not null default 'NGN' check (currency in ('NGN', 'USD')),
	exchange_rate numeric(12, 2),
	vat_rate numeric(6, 4) not null default 0.0750 check (vat_rate >= 0 and vat_rate <= 1),
	deposit_rate numeric(6, 4) not null default 0.7000 check (deposit_rate >= 0 and deposit_rate <= 1),
	total_ngn numeric(14, 2) not null default 0 check (total_ngn >= 0),
	current_version integer not null default 1 check (current_version >= 1),
	valid_until date not null,
	sent_at timestamptz,
	created_by uuid references auth.users (id) on delete set null,
	created_by_name text not null default '',
	cancel_reason text not null default '',
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

comment on table public.quotes is 'Client quotes with frozen rates and current lifecycle status.';

create index quotes_client_id_idx on public.quotes (client_id);
create index quotes_created_by_idx on public.quotes (created_by);
create index quotes_status_idx on public.quotes (status);
create index quotes_created_at_idx on public.quotes (created_at desc);

create trigger quotes_set_updated_at
	before update on public.quotes
	for each row execute function private.set_updated_at();

create table public.quote_versions (
	id uuid primary key default gen_random_uuid(),
	quote_id uuid not null references public.quotes (id) on delete cascade,
	version_number integer not null check (version_number >= 1),
	sent_line text not null default '',
	change_note text,
	changes jsonb,
	created_at timestamptz not null default now(),
	unique (quote_id, version_number)
);

comment on table public.quote_versions is 'Version snapshots for a quote; revisions keep all prior versions.';

create index quote_versions_quote_id_idx on public.quote_versions (quote_id);

create table public.quote_lines (
	id uuid primary key default gen_random_uuid(),
	quote_version_id uuid not null references public.quote_versions (id) on delete cascade,
	name text not null,
	description text not null default '',
	quantity numeric(10, 2) not null default 1 check (quantity > 0),
	unit_price numeric(14, 2) not null default 0 check (unit_price >= 0),
	sort_order integer not null default 0,
	created_at timestamptz not null default now()
);

comment on table public.quote_lines is 'Frozen line items belonging to a specific quote version.';

create index quote_lines_version_id_idx on public.quote_lines (quote_version_id);

create table public.quote_activity (
	id bigint generated always as identity primary key,
	quote_id uuid not null references public.quotes (id) on delete cascade,
	actor_id uuid references auth.users (id) on delete set null,
	when_label text not null,
	what text not null,
	detail text not null default '',
	created_at timestamptz not null default now()
);

comment on table public.quote_activity is 'Timeline events for a quote (creation, sends, follow-ups, deposit, cancellation).';

create index quote_activity_quote_id_idx on public.quote_activity (quote_id);
create index quote_activity_actor_id_idx on public.quote_activity (actor_id);

-- ----------------------------------------------------------------------------
-- 6. Default singleton rows so Cost Rates and Pricing & Margins always work
-- ----------------------------------------------------------------------------
insert into public.overhead_settings (id)
values (1)
on conflict (id) do nothing;

insert into public.pricing_rules (id)
values (1)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 7. Explicit grants & Row Level Security (RLS)
-- ----------------------------------------------------------------------------
revoke all on public.staff_members from anon;
revoke all on public.overhead_settings from anon;
revoke all on public.cost_items from anon;
revoke all on public.markup_categories from anon;
revoke all on public.pricing_rules from anon;
revoke all on public.pricing_history from anon;
revoke all on public.clients from anon;
revoke all on public.quotes from anon;
revoke all on public.quote_versions from anon;
revoke all on public.quote_lines from anon;
revoke all on public.quote_activity from anon;

grant select, insert, update, delete on public.staff_members to authenticated;
grant select, insert, update on public.overhead_settings to authenticated;
grant select, insert, update, delete on public.cost_items to authenticated;
grant select, insert, update on public.markup_categories to authenticated;
grant select, insert, update on public.pricing_rules to authenticated;
grant select, insert on public.pricing_history to authenticated;
grant select, insert, update, delete on public.clients to authenticated;
grant select, insert, update, delete on public.quotes to authenticated;
grant select, insert, update on public.quote_versions to authenticated;
grant select, insert, update, delete on public.quote_lines to authenticated;
grant select, insert on public.quote_activity to authenticated;

alter table public.staff_members enable row level security;
alter table public.overhead_settings enable row level security;
alter table public.cost_items enable row level security;
alter table public.markup_categories enable row level security;
alter table public.pricing_rules enable row level security;
alter table public.pricing_history enable row level security;
alter table public.clients enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_versions enable row level security;
alter table public.quote_lines enable row level security;
alter table public.quote_activity enable row level security;

-- Staff policies (MD, GM, Accounting only)
create policy "Authorized roles can read staff"
	on public.staff_members for select to authenticated
	using ((select private.authorize('pricing_rules.edit')));

create policy "Authorized roles can insert staff"
	on public.staff_members for insert to authenticated
	with check ((select private.authorize('pricing_rules.edit')));

create policy "Authorized roles can update staff"
	on public.staff_members for update to authenticated
	using ((select private.authorize('pricing_rules.edit')))
	with check ((select private.authorize('pricing_rules.edit')));

create policy "Authorized roles can delete staff"
	on public.staff_members for delete to authenticated
	using ((select private.authorize('pricing_rules.edit')));

-- Overhead settings policies (MD, GM, Accounting)
create policy "Authorized roles can read overhead settings"
	on public.overhead_settings for select to authenticated
	using ((select private.authorize('costs.view_full')));

create policy "Authorized roles can insert overhead settings"
	on public.overhead_settings for insert to authenticated
	with check ((select private.authorize('pricing_rules.edit')));

create policy "Authorized roles can update overhead settings"
	on public.overhead_settings for update to authenticated
	using ((select private.authorize('pricing_rules.edit')))
	with check ((select private.authorize('pricing_rules.edit')));

-- Cost items policies
create policy "Authorized roles can read cost items"
	on public.cost_items for select to authenticated
	using (
		(select private.authorize('costs.view_full'))
		or (select private.authorize('quotes.create'))
	);

create policy "Authorized roles can insert cost items"
	on public.cost_items for insert to authenticated
	with check ((select private.authorize('pricing_rules.edit')));

create policy "Authorized roles can update cost items"
	on public.cost_items for update to authenticated
	using ((select private.authorize('pricing_rules.edit')))
	with check ((select private.authorize('pricing_rules.edit')));

create policy "Authorized roles can delete cost items"
	on public.cost_items for delete to authenticated
	using ((select private.authorize('pricing_rules.edit')));

-- Markup categories policies
create policy "Authorized roles can read markup categories"
	on public.markup_categories for select to authenticated
	using (
		(select private.authorize('pricing_rules.edit'))
		or (select private.authorize('quotes.view_prices'))
	);

create policy "Authorized roles can insert markup categories"
	on public.markup_categories for insert to authenticated
	with check ((select private.authorize('pricing_rules.edit')));

create policy "Authorized roles can update markup categories"
	on public.markup_categories for update to authenticated
	using ((select private.authorize('pricing_rules.edit')))
	with check ((select private.authorize('pricing_rules.edit')));

-- Pricing rules policies
create policy "Active authenticated users can read pricing rules"
	on public.pricing_rules for select to authenticated
	using ((select private.current_user_role()) is not null);

create policy "Authorized roles can insert pricing rules"
	on public.pricing_rules for insert to authenticated
	with check ((select private.authorize('pricing_rules.edit')));

create policy "Authorized roles can update pricing rules"
	on public.pricing_rules for update to authenticated
	using ((select private.authorize('pricing_rules.edit')))
	with check ((select private.authorize('pricing_rules.edit')));

-- Pricing history policies (append-only)
create policy "Authorized roles can read pricing history"
	on public.pricing_history for select to authenticated
	using ((select private.authorize('pricing_rules.edit')));

create policy "Authorized roles can insert pricing history"
	on public.pricing_history for insert to authenticated
	with check ((select private.authorize('pricing_rules.edit')));

-- Clients policies
create policy "Authorized roles can read clients"
	on public.clients for select to authenticated
	using ((select private.authorize('quotes.view_prices')));

create policy "Authorized roles can insert clients"
	on public.clients for insert to authenticated
	with check (
		(select private.authorize('quotes.create'))
		or (select private.authorize('pricing_rules.edit'))
		or (select private.authorize('users.manage'))
	);

create policy "Authorized roles can update clients"
	on public.clients for update to authenticated
	using (
		(select private.authorize('quotes.create'))
		or (select private.authorize('pricing_rules.edit'))
		or (select private.authorize('users.manage'))
	)
	with check (
		(select private.authorize('quotes.create'))
		or (select private.authorize('pricing_rules.edit'))
		or (select private.authorize('users.manage'))
	);

create policy "MD and GM can delete clients"
	on public.clients for delete to authenticated
	using ((select private.authorize('users.manage')));

-- Quotes policies
create policy "Authorized roles can read quotes"
	on public.quotes for select to authenticated
	using ((select private.authorize('quotes.view')));

create policy "Authorized roles can create quotes"
	on public.quotes for insert to authenticated
	with check (
		(select private.authorize('quotes.create'))
		or (select private.authorize('users.manage'))
	);

create policy "Owners, Accounting, or quote creators can update quotes"
	on public.quotes for update to authenticated
	using (
		(select private.authorize('users.manage'))
		or (select private.authorize('invoices.edit'))
		or (
			(select private.authorize('quotes.create'))
			and (created_by = (select auth.uid()) or created_by is null)
		)
	)
	with check (
		(select private.authorize('users.manage'))
		or (select private.authorize('invoices.edit'))
		or (
			(select private.authorize('quotes.create'))
			and (created_by = (select auth.uid()) or created_by is null)
		)
	);

create policy "MD and GM can delete quotes"
	on public.quotes for delete to authenticated
	using ((select private.authorize('users.manage')));

-- Quote versions policies
create policy "Authorized roles can read quote versions"
	on public.quote_versions for select to authenticated
	using ((select private.authorize('quotes.view')));

create policy "Authorized roles can insert quote versions"
	on public.quote_versions for insert to authenticated
	with check (
		(select private.authorize('quotes.create'))
		or (select private.authorize('users.manage'))
		or (select private.authorize('invoices.edit'))
	);

create policy "Authorized roles can update quote versions"
	on public.quote_versions for update to authenticated
	using (
		(select private.authorize('quotes.create'))
		or (select private.authorize('users.manage'))
		or (select private.authorize('invoices.edit'))
	)
	with check (
		(select private.authorize('quotes.create'))
		or (select private.authorize('users.manage'))
		or (select private.authorize('invoices.edit'))
	);

-- Quote lines policies
create policy "Authorized roles can read quote lines"
	on public.quote_lines for select to authenticated
	using ((select private.authorize('quotes.view')));

create policy "Authorized roles can insert quote lines"
	on public.quote_lines for insert to authenticated
	with check (
		(select private.authorize('quotes.create'))
		or (select private.authorize('users.manage'))
	);

create policy "Authorized roles can update quote lines"
	on public.quote_lines for update to authenticated
	using (
		(select private.authorize('quotes.create'))
		or (select private.authorize('users.manage'))
	)
	with check (
		(select private.authorize('quotes.create'))
		or (select private.authorize('users.manage'))
	);

create policy "Authorized roles can delete quote lines"
	on public.quote_lines for delete to authenticated
	using (
		(select private.authorize('quotes.create'))
		or (select private.authorize('users.manage'))
	);

-- Quote activity policies (append-only)
create policy "Authorized roles can read quote activity"
	on public.quote_activity for select to authenticated
	using ((select private.authorize('quotes.view')));

create policy "Authorized roles can insert quote activity"
	on public.quote_activity for insert to authenticated
	with check (
		(select private.authorize('quotes.create'))
		or (select private.authorize('invoices.edit'))
		or (select private.authorize('users.manage'))
	);
