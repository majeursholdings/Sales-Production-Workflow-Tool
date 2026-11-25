-- ============================================================================
-- Furniture types & templates: the catalogue quotes are built from
-- ============================================================================
-- A furniture type belongs to a markup category (Pricing & margins) and holds a
-- template: standard parts (from inventory), labour hours per role (rates from
-- Staff), machine hours (rates from Machines) and other per-piece costs.
-- Rates are never copied into the template; they're resolved when costing, so
-- a change in Staff, Machines, Inventory or Cost rates flows into new quotes.

-- ----------------------------------------------------------------------------
-- 1. Furniture types
-- ----------------------------------------------------------------------------
create table public.furniture_types (
	id uuid primary key default gen_random_uuid(),
	name text not null check (length(trim(name)) > 0),
	category_id text not null references public.markup_categories (id) on update cascade on delete restrict,
	description text not null default '',
	build_notes text not null default '',
	lead_time text not null default '',
	standard_size text not null default '',
	crate_pieces integer not null default 1 check (crate_pieces > 0),
	status text not null default 'published' check (status in ('draft', 'published')),
	-- Photo URLs, cover first. Optional: upload isn't connected yet.
	photo_urls text[] not null default '{}',
	created_by uuid references auth.users (id) on delete set null,
	updated_by uuid references auth.users (id) on delete set null,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

comment on table public.furniture_types is 'Furniture catalogue: each type is a template that fills in parts and hours on quotes.';

create unique index furniture_types_name_key on public.furniture_types (lower(name));
create index furniture_types_category_id_idx on public.furniture_types (category_id);
create index furniture_types_created_by_idx on public.furniture_types (created_by);
create index furniture_types_updated_by_idx on public.furniture_types (updated_by);

create trigger furniture_types_set_updated_at
	before update on public.furniture_types
	for each row execute function private.set_updated_at();

-- ----------------------------------------------------------------------------
-- 2. Template rows
-- ----------------------------------------------------------------------------
create table public.furniture_type_parts (
	type_id uuid not null references public.furniture_types (id) on delete cascade,
	sku text not null references public.parts (sku) on update cascade on delete restrict,
	qty numeric(12, 2) not null check (qty > 0),
	sort_order integer not null default 0,
	primary key (type_id, sku)
);

comment on table public.furniture_type_parts is 'Standard parts and quantities for one piece of a furniture type.';

create index furniture_type_parts_sku_idx on public.furniture_type_parts (sku);

create table public.furniture_type_hours (
	id uuid primary key default gen_random_uuid(),
	type_id uuid not null references public.furniture_types (id) on delete cascade,
	kind text not null check (kind in ('labour', 'machine')),
	-- A production role from Staff (labour) or a machine name from Machines
	name text not null check (length(trim(name)) > 0),
	hours numeric(8, 2) not null default 0 check (hours >= 0),
	sort_order integer not null default 0,
	unique (type_id, kind, name)
);

comment on table public.furniture_type_hours is 'Labour hours per role and machine hours per machine for one piece of a furniture type.';

create table public.furniture_type_extras (
	id uuid primary key default gen_random_uuid(),
	type_id uuid not null references public.furniture_types (id) on delete cascade,
	cost_item_id uuid references public.cost_items (id) on delete set null,
	name text not null check (length(trim(name)) > 0),
	cost_type text not null default 'Direct' check (cost_type in ('Direct', 'Indirect')),
	amount numeric(14, 2) not null default 0 check (amount >= 0),
	sort_order integer not null default 0,
	unique (type_id, name)
);

comment on table public.furniture_type_extras is 'Other costs charged on every piece of a furniture type (wrapping, crating, ...).';

create index furniture_type_extras_cost_item_id_idx on public.furniture_type_extras (cost_item_id);

-- ----------------------------------------------------------------------------
-- 3. Keep markup_categories.furniture_types_count in step
-- ----------------------------------------------------------------------------
create or replace function private.refresh_furniture_type_counts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_ids text[] := '{}';
begin
	if tg_op in ('INSERT', 'UPDATE') then
		v_ids := v_ids || new.category_id;
	end if;
	if tg_op in ('UPDATE', 'DELETE') then
		v_ids := v_ids || old.category_id;
	end if;

	update public.markup_categories mc
	set furniture_types_count = (
		select count(*) from public.furniture_types ft where ft.category_id = mc.id
	)
	where mc.id = any (v_ids);
	return null;
end;
$$;

revoke all on function private.refresh_furniture_type_counts() from public, anon, authenticated;

create trigger furniture_types_refresh_counts
	after insert or delete or update of category_id on public.furniture_types
	for each row execute function private.refresh_furniture_type_counts();

-- ----------------------------------------------------------------------------
-- 4. Save a type and its whole template in one transaction
-- ----------------------------------------------------------------------------
-- p_details: name, category_id, description, build_notes, lead_time,
--            standard_size, crate_pieces, status, photo_urls
-- p_parts:   [{ sku, qty }]
-- p_hours:   [{ kind, name, hours }]
-- p_extras:  [{ name, cost_type, amount, cost_item_id }]
create or replace function public.save_furniture_type(
	p_id uuid,
	p_details jsonb,
	p_parts jsonb,
	p_hours jsonb,
	p_extras jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
	v_id uuid := p_id;
	v_photos text[] := coalesce(
		(select array_agg(value) from jsonb_array_elements_text(p_details -> 'photo_urls')),
		'{}'
	);
begin
	if v_id is null then
		insert into public.furniture_types (
			name, category_id, description, build_notes, lead_time, standard_size,
			crate_pieces, status, photo_urls, created_by, updated_by
		)
		values (
			trim(p_details ->> 'name'),
			p_details ->> 'category_id',
			coalesce(p_details ->> 'description', ''),
			coalesce(p_details ->> 'build_notes', ''),
			coalesce(p_details ->> 'lead_time', ''),
			coalesce(p_details ->> 'standard_size', ''),
			coalesce((p_details ->> 'crate_pieces')::integer, 1),
			coalesce(p_details ->> 'status', 'published'),
			v_photos,
			auth.uid(),
			auth.uid()
		)
		returning id into v_id;
	else
		update public.furniture_types
		set name = trim(p_details ->> 'name'),
			category_id = p_details ->> 'category_id',
			description = coalesce(p_details ->> 'description', ''),
			build_notes = coalesce(p_details ->> 'build_notes', ''),
			lead_time = coalesce(p_details ->> 'lead_time', lead_time),
			standard_size = coalesce(p_details ->> 'standard_size', standard_size),
			crate_pieces = coalesce((p_details ->> 'crate_pieces')::integer, crate_pieces),
			status = coalesce(p_details ->> 'status', status),
			photo_urls = v_photos,
			updated_by = auth.uid()
		where id = v_id;
		if not found then
			raise exception 'Furniture type % not found', v_id;
		end if;

		delete from public.furniture_type_parts where type_id = v_id;
		delete from public.furniture_type_hours where type_id = v_id;
		delete from public.furniture_type_extras where type_id = v_id;
	end if;

	insert into public.furniture_type_parts (type_id, sku, qty, sort_order)
	select v_id, e.value ->> 'sku', (e.value ->> 'qty')::numeric, e.ordinality::integer
	from jsonb_array_elements(coalesce(p_parts, '[]'::jsonb)) with ordinality as e;

	insert into public.furniture_type_hours (type_id, kind, name, hours, sort_order)
	select v_id, e.value ->> 'kind', trim(e.value ->> 'name'), (e.value ->> 'hours')::numeric, e.ordinality::integer
	from jsonb_array_elements(coalesce(p_hours, '[]'::jsonb)) with ordinality as e;

	insert into public.furniture_type_extras (type_id, cost_item_id, name, cost_type, amount, sort_order)
	select
		v_id,
		nullif(e.value ->> 'cost_item_id', '')::uuid,
		trim(e.value ->> 'name'),
		coalesce(e.value ->> 'cost_type', 'Direct'),
		(e.value ->> 'amount')::numeric,
		e.ordinality::integer
	from jsonb_array_elements(coalesce(p_extras, '[]'::jsonb)) with ordinality as e;

	return v_id;
end;
$$;

revoke all on function public.save_furniture_type(uuid, jsonb, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.save_furniture_type(uuid, jsonb, jsonb, jsonb, jsonb) to authenticated;

-- ----------------------------------------------------------------------------
-- 5. Costing inputs for templates and the quote builder
-- ----------------------------------------------------------------------------
-- Sales, customer care and procurement price furniture but can't read Staff,
-- overhead settings or (for sales) the parts table directly. This returns just
-- what costing needs: categories with markups, parts with unit cost and
-- availability, average hourly rate per production role, machine hourly rates,
-- workshop overhead per labour hour and contingency. Callers without
-- quotes.view_prices (production) get names and quantities only, never costs.
create or replace function public.furniture_costing()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_costs boolean;
	v_settings record;
	v_backend_monthly numeric;
	v_production_count integer;
	v_hours numeric;
begin
	if not (
		(select private.authorize('templates.view'))
		or (select private.authorize('quotes.create'))
	) then
		raise exception 'Not allowed to view furniture costing' using errcode = '42501';
	end if;

	v_costs := (select private.authorize('quotes.view_prices'));

	select rent_monthly, power_monthly, other_monthly, hours_per_production_person, contingency_percent
	into v_settings
	from public.overhead_settings
	where id = 1;

	select coalesce(sum(hourly_rate * hours_per_month), 0)
	into v_backend_monthly
	from public.staff_members
	where is_active and team = 'Non-production';

	select count(*)
	into v_production_count
	from public.staff_members
	where is_active and team = 'Production';

	v_hours := v_production_count * coalesce(v_settings.hours_per_production_person, 160);

	return jsonb_build_object(
		'can_see_costs', v_costs,
		'categories', (
			select coalesce(jsonb_agg(jsonb_build_object(
				'id', id,
				'name', name,
				'markup', case when v_costs then markup_percent end,
				'ceiling', case when v_costs then ceiling_percent end
			) order by sort_order, name), '[]'::jsonb)
			from public.markup_categories
		),
		'parts', (
			select coalesce(jsonb_agg(jsonb_build_object(
				'sku', sku,
				'name', name,
				'spec', spec,
				'unit', unit,
				'category', category,
				'unit_cost', case when v_costs then unit_cost end,
				'available', in_stock - reserved
			) order by name), '[]'::jsonb)
			from public.parts
			where not is_archived
		),
		'labour_rates', (
			select coalesce(jsonb_agg(jsonb_build_object(
				'name', role,
				'rate', case when v_costs then round(avg_rate, 2) end
			) order by role), '[]'::jsonb)
			from (
				select role, avg(hourly_rate) as avg_rate
				from public.staff_members
				where is_active and team = 'Production'
				group by role
			) r
		),
		'machine_rates', (
			select coalesce(jsonb_agg(jsonb_build_object(
				'name', name,
				'rate', case when v_costs then hourly_cost end
			) order by name), '[]'::jsonb)
			from public.machines
			where not is_archived
		),
		'overhead_per_labour_hour', case when v_costs then
			case when v_hours > 0 then round(
				(
					coalesce(v_settings.rent_monthly, 0)
					+ coalesce(v_settings.power_monthly, 0)
					+ coalesce(v_settings.other_monthly, 0)
					+ v_backend_monthly
				) / v_hours,
				2
			) else 0 end
		end,
		'contingency_percent', case when v_costs then coalesce(v_settings.contingency_percent, 5) end
	);
end;
$$;

revoke all on function public.furniture_costing() from public, anon;
grant execute on function public.furniture_costing() to authenticated;

-- ----------------------------------------------------------------------------
-- 6. Grants & Row Level Security
-- ----------------------------------------------------------------------------
revoke all on public.furniture_types from anon;
revoke all on public.furniture_type_parts from anon;
revoke all on public.furniture_type_hours from anon;
revoke all on public.furniture_type_extras from anon;

grant select, insert, update, delete on public.furniture_types to authenticated;
grant select, insert, update, delete on public.furniture_type_parts to authenticated;
grant select, insert, update, delete on public.furniture_type_hours to authenticated;
grant select, insert, update, delete on public.furniture_type_extras to authenticated;

alter table public.furniture_types enable row level security;
alter table public.furniture_type_parts enable row level security;
alter table public.furniture_type_hours enable row level security;
alter table public.furniture_type_extras enable row level security;

-- Furniture types: published ones for everyone who views templates or builds
-- quotes; drafts only for template editors.
create policy "Template viewers can read published furniture types"
	on public.furniture_types for select to authenticated
	using (
		(
			status = 'published'
			and (
				(select private.authorize('templates.view'))
				or (select private.authorize('quotes.create'))
			)
		)
		or (select private.authorize('templates.edit'))
	);

create policy "Template editors can insert furniture types"
	on public.furniture_types for insert to authenticated
	with check ((select private.authorize('templates.edit')));

create policy "Template editors can update furniture types"
	on public.furniture_types for update to authenticated
	using ((select private.authorize('templates.edit')))
	with check ((select private.authorize('templates.edit')));

create policy "Template editors can delete furniture types"
	on public.furniture_types for delete to authenticated
	using ((select private.authorize('templates.edit')));

-- Template rows follow their type's visibility (RLS on furniture_types applies
-- inside the subquery).
create policy "Template viewers can read furniture type parts"
	on public.furniture_type_parts for select to authenticated
	using (exists (select 1 from public.furniture_types ft where ft.id = type_id));

create policy "Template editors can insert furniture type parts"
	on public.furniture_type_parts for insert to authenticated
	with check ((select private.authorize('templates.edit')));

create policy "Template editors can update furniture type parts"
	on public.furniture_type_parts for update to authenticated
	using ((select private.authorize('templates.edit')))
	with check ((select private.authorize('templates.edit')));

create policy "Template editors can delete furniture type parts"
	on public.furniture_type_parts for delete to authenticated
	using ((select private.authorize('templates.edit')));

create policy "Template viewers can read furniture type hours"
	on public.furniture_type_hours for select to authenticated
	using (exists (select 1 from public.furniture_types ft where ft.id = type_id));

create policy "Template editors can insert furniture type hours"
	on public.furniture_type_hours for insert to authenticated
	with check ((select private.authorize('templates.edit')));

create policy "Template editors can update furniture type hours"
	on public.furniture_type_hours for update to authenticated
	using ((select private.authorize('templates.edit')))
	with check ((select private.authorize('templates.edit')));

create policy "Template editors can delete furniture type hours"
	on public.furniture_type_hours for delete to authenticated
	using ((select private.authorize('templates.edit')));

create policy "Template viewers can read furniture type extras"
	on public.furniture_type_extras for select to authenticated
	using (exists (select 1 from public.furniture_types ft where ft.id = type_id));

create policy "Template editors can insert furniture type extras"
	on public.furniture_type_extras for insert to authenticated
	with check ((select private.authorize('templates.edit')));

create policy "Template editors can update furniture type extras"
	on public.furniture_type_extras for update to authenticated
	using ((select private.authorize('templates.edit')))
	with check ((select private.authorize('templates.edit')));

create policy "Template editors can delete furniture type extras"
	on public.furniture_type_extras for delete to authenticated
	using ((select private.authorize('templates.edit')));
