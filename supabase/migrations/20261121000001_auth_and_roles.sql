-- ============================================================================
-- Supabase Authentication, Profiles, RBAC Roles & Permissions, Audit Logs
-- ============================================================================

-- Private schema for internal SECURITY DEFINER helpers (never exposed via Data API)
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role, supabase_auth_admin;

-- ----------------------------------------------------------------------------
-- 1. Role & permission enums
-- ----------------------------------------------------------------------------
create type public.app_role as enum (
	'md',
	'gm',
	'accounting',
	'procurement',
	'production',
	'sales',
	'customer_care'
);

create type public.app_permission as enum (
	'users.manage',
	'materials.view',
	'materials.view_prices',
	'materials.edit',
	'templates.view',
	'templates.edit',
	'pricing_rules.edit',
	'quotes.view',
	'quotes.view_prices',
	'quotes.create',
	'quotes.send_any',
	'costs.view_materials',
	'costs.view_full',
	'invoices.view',
	'invoices.send',
	'invoices.edit',
	'work_orders.view',
	'work_orders.edit_status',
	'purchase_orders.view',
	'purchase_orders.edit',
	'audit_log.view',
	'settings.company'
);

-- ----------------------------------------------------------------------------
-- 2. Tables
-- ----------------------------------------------------------------------------
create table public.profiles (
	id uuid primary key references auth.users (id) on delete cascade,
	full_name text not null,
	email text not null unique,
	phone text not null default '',
	is_active boolean not null default true,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Application user profiles linked 1:1 with auth.users.';

create table public.user_roles (
	id bigint generated always as identity primary key,
	user_id uuid not null unique references auth.users (id) on delete cascade,
	role public.app_role not null,
	assigned_by uuid references auth.users (id) on delete set null,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

comment on table public.user_roles is 'Single application role assigned to each user.';

create index user_roles_assigned_by_idx on public.user_roles (assigned_by);

create table public.role_permissions (
	id bigint generated always as identity primary key,
	role public.app_role not null,
	permission public.app_permission not null,
	unique (role, permission)
);

comment on table public.role_permissions is 'Capability matrix mapping each app_role to its app_permissions.';

create table public.audit_logs (
	id bigint generated always as identity primary key,
	actor_id uuid references auth.users (id) on delete set null,
	action text not null,
	entity_type text not null,
	entity_id text not null,
	old_values jsonb,
	new_values jsonb,
	created_at timestamptz not null default now()
);

comment on table public.audit_logs is 'Append-only activity history for role, user, pricing, and status changes.';

create index audit_logs_actor_id_idx on public.audit_logs (actor_id);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index audit_logs_created_at_idx on public.audit_logs (created_at desc);

-- ----------------------------------------------------------------------------
-- 3. Seed default role-permission matrix
-- ----------------------------------------------------------------------------
insert into public.role_permissions (role, permission)
values
	-- Managing Director (full access)
	('md', 'users.manage'),
	('md', 'materials.view'),
	('md', 'materials.view_prices'),
	('md', 'materials.edit'),
	('md', 'templates.view'),
	('md', 'templates.edit'),
	('md', 'pricing_rules.edit'),
	('md', 'quotes.view'),
	('md', 'quotes.view_prices'),
	('md', 'quotes.create'),
	('md', 'quotes.send_any'),
	('md', 'costs.view_materials'),
	('md', 'costs.view_full'),
	('md', 'invoices.view'),
	('md', 'invoices.send'),
	('md', 'invoices.edit'),
	('md', 'work_orders.view'),
	('md', 'work_orders.edit_status'),
	('md', 'purchase_orders.view'),
	('md', 'purchase_orders.edit'),
	('md', 'audit_log.view'),
	('md', 'settings.company'),

	-- General Manager (full access)
	('gm', 'users.manage'),
	('gm', 'materials.view'),
	('gm', 'materials.view_prices'),
	('gm', 'materials.edit'),
	('gm', 'templates.view'),
	('gm', 'templates.edit'),
	('gm', 'pricing_rules.edit'),
	('gm', 'quotes.view'),
	('gm', 'quotes.view_prices'),
	('gm', 'quotes.create'),
	('gm', 'quotes.send_any'),
	('gm', 'costs.view_materials'),
	('gm', 'costs.view_full'),
	('gm', 'invoices.view'),
	('gm', 'invoices.send'),
	('gm', 'invoices.edit'),
	('gm', 'work_orders.view'),
	('gm', 'work_orders.edit_status'),
	('gm', 'purchase_orders.view'),
	('gm', 'purchase_orders.edit'),
	('gm', 'audit_log.view'),
	('gm', 'settings.company'),

	-- Accounting
	('accounting', 'materials.view'),
	('accounting', 'materials.view_prices'),
	('accounting', 'templates.view'),
	('accounting', 'pricing_rules.edit'),
	('accounting', 'quotes.view'),
	('accounting', 'quotes.view_prices'),
	('accounting', 'quotes.send_any'),
	('accounting', 'costs.view_materials'),
	('accounting', 'costs.view_full'),
	('accounting', 'invoices.view'),
	('accounting', 'invoices.send'),
	('accounting', 'invoices.edit'),
	('accounting', 'work_orders.view'),
	('accounting', 'purchase_orders.view'),
	('accounting', 'audit_log.view'),

	-- Procurement lead
	('procurement', 'materials.view'),
	('procurement', 'materials.view_prices'),
	('procurement', 'materials.edit'),
	('procurement', 'templates.view'),
	('procurement', 'quotes.view'),
	('procurement', 'quotes.view_prices'),
	('procurement', 'costs.view_materials'),
	('procurement', 'work_orders.view'),
	('procurement', 'purchase_orders.view'),
	('procurement', 'purchase_orders.edit'),

	-- Production (no prices or cost breakdown)
	('production', 'materials.view'),
	('production', 'templates.view'),
	('production', 'templates.edit'),
	('production', 'quotes.view'),
	('production', 'work_orders.view'),
	('production', 'work_orders.edit_status'),
	('production', 'purchase_orders.view'),

	-- Sales
	('sales', 'templates.view'),
	('sales', 'quotes.view'),
	('sales', 'quotes.view_prices'),
	('sales', 'quotes.create'),
	('sales', 'invoices.view'),
	('sales', 'invoices.send'),
	('sales', 'work_orders.view'),

	-- Customer care
	('customer_care', 'templates.view'),
	('customer_care', 'quotes.view'),
	('customer_care', 'quotes.view_prices'),
	('customer_care', 'quotes.create'),
	('customer_care', 'invoices.view'),
	('customer_care', 'invoices.send'),
	('customer_care', 'work_orders.view')
on conflict (role, permission) do nothing;

-- ----------------------------------------------------------------------------
-- 4. Internal helper & trigger functions (in private schema)
-- ----------------------------------------------------------------------------
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
	new.updated_at := now();
	return new;
end;
$$;

create trigger profiles_set_updated_at
	before update on public.profiles
	for each row execute function private.set_updated_at();

create trigger user_roles_set_updated_at
	before update on public.user_roles
	for each row execute function private.set_updated_at();

-- Resolve the calling user's active role.
-- Prefers the verified JWT custom claim (populated by custom_access_token_hook)
-- and falls back to public.user_roles so policies still work before the hook is enabled.
create or replace function private.current_user_role()
returns public.app_role
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_uid uuid := (select auth.uid());
	v_active boolean;
	v_claim text;
	v_role public.app_role;
begin
	if v_uid is null then
		return null;
	end if;

	select is_active into v_active
	from public.profiles
	where id = v_uid;

	if coalesce(v_active, false) = false then
		return null;
	end if;

	v_claim := nullif(auth.jwt() ->> 'user_role', '');
	if v_claim is not null then
		begin
			return v_claim::public.app_role;
		exception when invalid_text_representation then
			null;
		end;
	end if;

	select role into v_role
	from public.user_roles
	where user_id = v_uid;

	return v_role;
end;
$$;

revoke all on function private.current_user_role() from public, anon;
grant execute on function private.current_user_role() to authenticated, service_role;

-- Permission check for RLS policies across the entire database.
create or replace function private.authorize(requested_permission public.app_permission)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_role public.app_role;
begin
	v_role := private.current_user_role();
	if v_role is null then
		return false;
	end if;

	return exists (
		select 1
		from public.role_permissions
		where role = v_role
			and permission = requested_permission
	);
end;
$$;

revoke all on function private.authorize(public.app_permission) from public, anon;
grant execute on function private.authorize(public.app_permission) to authenticated, service_role;

-- Prevent non-superadmins from self-activating or changing their own email in profiles.
create or replace function private.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	if current_user = 'authenticated' and not private.authorize('users.manage') then
		if new.is_active is distinct from old.is_active then
			raise exception 'Only MD or GM can change account active status';
		end if;
		if new.email is distinct from old.email then
			raise exception 'Email can only be changed through authentication settings';
		end if;
	end if;
	return new;
end;
$$;

create trigger profiles_guard_update
	before update on public.profiles
	for each row execute function private.guard_profile_update();

-- Automatically create a profile (and role if set in admin-only app_metadata) on user signup/invite.
-- SECURITY: Never read roles from raw_user_meta_data because users can edit it.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_name text;
	v_phone text;
	v_role_text text;
	v_role public.app_role;
begin
	v_name := coalesce(
		nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
		split_part(coalesce(new.email, ''), '@', 1),
		'Staff Member'
	);
	v_phone := coalesce(trim(new.raw_user_meta_data ->> 'phone'), '');

	insert into public.profiles (id, full_name, email, phone)
	values (new.id, v_name, coalesce(new.email, ''), v_phone)
	on conflict (id) do update
		set email = excluded.email;

	v_role_text := nullif(trim(new.raw_app_meta_data ->> 'role'), '');
	if v_role_text is not null then
		begin
			v_role := v_role_text::public.app_role;
			insert into public.user_roles (user_id, role)
			values (new.id, v_role)
			on conflict (user_id) do update
				set role = excluded.role;
		exception when invalid_text_representation then
			null;
		end;
	end if;

	return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
	after insert on auth.users
	for each row execute function private.handle_new_user();

-- ----------------------------------------------------------------------------
-- 5. Custom Access Token Auth Hook
-- Enable in Supabase Dashboard -> Authentication -> Hooks -> Custom Access Token
-- ----------------------------------------------------------------------------
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
	claims jsonb;
	v_role public.app_role;
	v_active boolean;
	v_name text;
begin
	select r.role, p.is_active, p.full_name
	into v_role, v_active, v_name
	from public.profiles p
	left join public.user_roles r on r.user_id = p.id
	where p.id = (event ->> 'user_id')::uuid;

	claims := event -> 'claims';

	if v_role is not null then
		claims := jsonb_set(claims, '{user_role}', to_jsonb(v_role));
	else
		claims := jsonb_set(claims, '{user_role}', 'null'::jsonb);
	end if;

	claims := jsonb_set(claims, '{user_active}', to_jsonb(coalesce(v_active, false)));

	if v_name is not null then
		claims := jsonb_set(claims, '{full_name}', to_jsonb(v_name));
	end if;

	event := jsonb_set(event, '{claims}', claims);
	return event;
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 6. Explicit grants & Row Level Security (RLS)
-- ----------------------------------------------------------------------------
revoke all on public.profiles from anon;
revoke all on public.user_roles from anon;
revoke all on public.role_permissions from anon;
revoke all on public.audit_logs from anon;

grant select, update on public.profiles to authenticated;
grant select on public.profiles to supabase_auth_admin;

grant select, insert, update, delete on public.user_roles to authenticated;
grant select on public.user_roles to supabase_auth_admin;

grant select on public.role_permissions to authenticated;

grant select, insert on public.audit_logs to authenticated;

-- Enable RLS on every table
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.audit_logs enable row level security;

-- Profiles policies
create policy "Auth admin can read profiles for JWT hook"
	on public.profiles
	for select
	to supabase_auth_admin
	using (true);

create policy "Users can view own profile or MD/GM can view all"
	on public.profiles
	for select
	to authenticated
	using (
		(select auth.uid()) = id
		or (select private.authorize('users.manage'))
	);

create policy "Users can update own profile"
	on public.profiles
	for update
	to authenticated
	using ((select auth.uid()) = id)
	with check ((select auth.uid()) = id);

create policy "MD and GM can update any profile"
	on public.profiles
	for update
	to authenticated
	using ((select private.authorize('users.manage')))
	with check ((select private.authorize('users.manage')));

-- User roles policies
create policy "Auth admin can read user roles for JWT hook"
	on public.user_roles
	for select
	to supabase_auth_admin
	using (true);

create policy "Users can view own role or MD/GM can view all"
	on public.user_roles
	for select
	to authenticated
	using (
		(select auth.uid()) = user_id
		or (select private.authorize('users.manage'))
	);

create policy "MD and GM can assign roles"
	on public.user_roles
	for insert
	to authenticated
	with check ((select private.authorize('users.manage')));

create policy "MD and GM can update roles"
	on public.user_roles
	for update
	to authenticated
	using ((select private.authorize('users.manage')))
	with check ((select private.authorize('users.manage')));

create policy "MD and GM can remove roles"
	on public.user_roles
	for delete
	to authenticated
	using ((select private.authorize('users.manage')));

-- Role permissions policies (read-only reference for authenticated users)
create policy "Authenticated users can read role permissions"
	on public.role_permissions
	for select
	to authenticated
	using (true);

-- Audit logs policies (append-only)
create policy "Authorized roles can read audit logs"
	on public.audit_logs
	for select
	to authenticated
	using ((select private.authorize('audit_log.view')));

create policy "Authenticated users can append own audit logs"
	on public.audit_logs
	for insert
	to authenticated
	with check ((select auth.uid()) = actor_id);

-- Backfill profiles for any auth.users accounts that existed before this migration
insert into public.profiles (id, full_name, email, phone)
select
	u.id,
	coalesce(
		nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
		split_part(coalesce(u.email, ''), '@', 1),
		'Staff Member'
	),
	coalesce(u.email, ''),
	coalesce(trim(u.raw_user_meta_data ->> 'phone'), '')
from auth.users u
where u.email is not null
on conflict (id) do nothing;

