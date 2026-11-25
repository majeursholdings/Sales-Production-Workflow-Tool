-- ============================================================================
-- Machines (with maintenance history) and Job cards (work orders)
-- ============================================================================
-- Access:
--   Machines are read by anyone who can see job cards or materials
--   (work_orders.view or materials.view) and changed by anyone who can move
--   job cards on or edit materials (work_orders.edit_status or materials.edit):
--   production, procurement, MD and GM. Deleting a maintenance record is for
--   the MD or GM only; machines themselves are archived, never deleted, so
--   logged machine time keeps its machine.
--   Job cards are read with work_orders.view and changed with
--   work_orders.edit_status.

-- ----------------------------------------------------------------------------
-- 1. Machines
-- ----------------------------------------------------------------------------
create table public.machines (
	id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	name text not null check (length(trim(name)) > 0),
	serial_number text not null default '',
	location text not null default '',
	bought text not null default '',
	hourly_cost numeric(14, 2) not null default 0 check (hourly_cost >= 0),
	service_every_months smallint not null default 3 check (service_every_months between 1 and 24),
	notes text not null default '',
	condition text not null default 'working' check (condition in ('working', 'out_of_service')),
	next_service date,
	is_archived boolean not null default false,
	created_by uuid references auth.users (id) on delete set null,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

comment on table public.machines is 'Workshop machines. Hourly cost prices machine time on quotes. Archived instead of deleted.';

create index machines_created_by_idx on public.machines (created_by);
create index machines_active_idx on public.machines (name) where is_archived = false;

create trigger machines_set_updated_at
	before update on public.machines
	for each row execute function private.set_updated_at();

create table public.machine_maintenance (
	id uuid primary key default gen_random_uuid(),
	machine_id text not null references public.machines (id) on update cascade on delete cascade,
	done_on date not null,
	type text not null check (
		type in ('Servicing', 'Oil change', 'Rubber change', 'Parts change', 'Repair', 'Inspection', 'Other')
	),
	notes text not null default '',
	done_by text not null,
	logged_by text not null,
	logged_by_id uuid references auth.users (id) on delete set null,
	cost numeric(14, 2) not null default 0 check (cost >= 0),
	photo_count integer not null default 0 check (photo_count >= 0),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

comment on table public.machine_maintenance is 'Servicing, repairs and parts changes logged against a machine.';

create index machine_maintenance_machine_idx on public.machine_maintenance (machine_id, done_on desc);
create index machine_maintenance_logged_by_id_idx on public.machine_maintenance (logged_by_id);

create trigger machine_maintenance_set_updated_at
	before update on public.machine_maintenance
	for each row execute function private.set_updated_at();

-- ----------------------------------------------------------------------------
-- 2. Job cards
-- ----------------------------------------------------------------------------
create sequence public.job_card_number_seq;

create table public.job_cards (
	number text primary key,
	quote_id uuid references public.quotes (id) on delete set null,
	quote_number text not null default '',
	client_id uuid references public.clients (id) on delete set null,
	client_name text not null,
	items_summary text not null default '',
	icon text not null default 'other'
		check (icon in ('sofa', 'coffee', 'lounge', 'dining', 'dchair', 'desk', 'bed', 'storage', 'other')),
	due date not null,
	address text not null default '',
	delivery_state text not null default 'not_booked'
		check (delivery_state in ('not_booked', 'booked', 'rejected', 'delivered')),
	delivery_note text not null default 'Not booked',
	delivery_booked_for date,
	note text not null default '',
	rejected_note text,
	closed boolean not null default false,
	closed_on date,
	created_by uuid references auth.users (id) on delete set null,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

comment on table public.job_cards is 'Production job cards, one per confirmed quote, tracking six steps from cutting to delivery.';

-- One job card per quote
create unique index job_cards_quote_id_key on public.job_cards (quote_id) where quote_id is not null;
create index job_cards_client_id_idx on public.job_cards (client_id);
create index job_cards_created_by_idx on public.job_cards (created_by);
create index job_cards_open_idx on public.job_cards (due) where closed = false;

create trigger job_cards_set_updated_at
	before update on public.job_cards
	for each row execute function private.set_updated_at();

create table public.job_card_items (
	id uuid primary key default gen_random_uuid(),
	job_card text not null references public.job_cards (number) on update cascade on delete cascade,
	name text not null,
	kind text not null default 'other'
		check (kind in ('sofa', 'coffee', 'lounge', 'dining', 'dchair', 'desk', 'bed', 'storage', 'other')),
	spec text not null default '',
	qty integer not null default 1 check (qty > 0),
	sort_order integer not null default 0
);

comment on table public.job_card_items is 'What a job card builds, with the spec from the quote.';

create index job_card_items_job_card_idx on public.job_card_items (job_card, sort_order);

create table public.job_card_parts (
	job_card text not null references public.job_cards (number) on update cascade on delete cascade,
	sku text not null references public.parts (sku) on update cascade on delete restrict,
	qty numeric(12, 2) not null check (qty > 0),
	-- Units of the part held in stock for this card (counted in parts.reserved)
	reserved numeric(12, 2) not null default 0 check (reserved >= 0),
	picked boolean not null default false,
	primary key (job_card, sku),
	constraint reserved_within_qty check (reserved <= qty)
);

comment on table public.job_card_parts is 'Parts picking list: what a job card needs, how much is reserved, and whether it has been picked.';

create index job_card_parts_sku_idx on public.job_card_parts (sku);

create table public.job_card_steps (
	job_card text not null references public.job_cards (number) on update cascade on delete cascade,
	step_index smallint not null check (step_index between 0 and 5),
	status text not null default 'todo' check (status in ('todo', 'active', 'done', 'redo', 'blocked')),
	planned_hours numeric(8, 2) not null default 0 check (planned_hours >= 0),
	primary key (job_card, step_index)
);

comment on table public.job_card_steps is 'The six steps of a job card (cutting, assembly, upholstery, finishing, quality check, delivery).';

create table public.job_card_step_machines (
	job_card text not null,
	step_index smallint not null,
	machine_id text not null references public.machines (id) on update cascade on delete restrict,
	hours numeric(8, 2) not null check (hours > 0),
	primary key (job_card, step_index, machine_id),
	foreign key (job_card, step_index)
		references public.job_card_steps (job_card, step_index) on update cascade on delete cascade
);

comment on table public.job_card_step_machines is 'Machine hours planned for a step.';

create index job_card_step_machines_machine_idx on public.job_card_step_machines (machine_id);

create table public.job_card_time_entries (
	id uuid primary key default gen_random_uuid(),
	job_card text not null references public.job_cards (number) on update cascade on delete cascade,
	step_index smallint not null,
	staff_id uuid references public.staff_members (id) on delete set null,
	who text not null,
	worked_on date not null,
	hours numeric(8, 2) not null check (hours > 0),
	redo_note text,
	notes text not null default '',
	logged_by uuid references auth.users (id) on delete set null,
	created_at timestamptz not null default now(),
	foreign key (job_card, step_index)
		references public.job_card_steps (job_card, step_index) on update cascade on delete cascade
);

comment on table public.job_card_time_entries is 'Hours someone worked on a job card step.';

create index job_card_time_entries_step_idx on public.job_card_time_entries (job_card, step_index);
create index job_card_time_entries_staff_id_idx on public.job_card_time_entries (staff_id);
create index job_card_time_entries_logged_by_idx on public.job_card_time_entries (logged_by);
create index job_card_time_entries_worked_on_idx on public.job_card_time_entries (worked_on desc);

create table public.job_card_time_entry_machines (
	entry_id uuid not null references public.job_card_time_entries (id) on delete cascade,
	machine_id text not null references public.machines (id) on update cascade on delete restrict,
	hours numeric(8, 2) not null check (hours > 0),
	primary key (entry_id, machine_id)
);

comment on table public.job_card_time_entry_machines is 'Machine time within a time entry; feeds each machine''s usage.';

create index job_card_time_entry_machines_machine_idx on public.job_card_time_entry_machines (machine_id);

create table public.job_card_redos (
	id uuid primary key default gen_random_uuid(),
	job_card text not null references public.job_cards (number) on update cascade on delete cascade,
	step_index smallint not null,
	reason text not null,
	hours numeric(8, 2) not null check (hours >= 0),
	found_at text not null,
	happened_on date not null,
	recorded_by uuid references auth.users (id) on delete set null,
	created_at timestamptz not null default now(),
	foreign key (job_card, step_index)
		references public.job_card_steps (job_card, step_index) on update cascade on delete cascade
);

comment on table public.job_card_redos is 'Work found wrong in the workshop, or rejected by the client at delivery.';

create index job_card_redos_step_idx on public.job_card_redos (job_card, step_index);
create index job_card_redos_recorded_by_idx on public.job_card_redos (recorded_by);
create index job_card_redos_happened_on_idx on public.job_card_redos (happened_on desc);

-- ----------------------------------------------------------------------------
-- 3. Functions
-- ----------------------------------------------------------------------------

-- Active Production staff, for "who worked on this". staff_members itself is
-- only readable by pricing roles (it holds pay rates), so this exposes names only.
create or replace function public.workshop_people()
returns table (id uuid, full_name text)
language sql
stable
security definer
set search_path = ''
as $$
	select s.id, s.full_name
	from public.staff_members s
	where s.team = 'Production'
		and s.is_active
		and (select private.authorize('work_orders.view'))
	order by s.full_name;
$$;

revoke all on function public.workshop_people() from public, anon;
grant execute on function public.workshop_people() to authenticated;

-- Holds what's free in stock for a job card's unpicked parts, and blocks or
-- unblocks cutting depending on whether anything is still short.
-- Security definer because production may not update parts directly.
create or replace function public.reserve_job_card_parts(p_number text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_line record;
	v_take numeric;
	v_short boolean;
begin
	if not private.authorize('work_orders.edit_status') then
		raise exception 'Not allowed to change job cards' using errcode = '42501';
	end if;

	if not exists (select 1 from public.job_cards where number = p_number and not closed) then
		raise exception 'Job card % is not open', p_number;
	end if;

	for v_line in
		select jp.sku, jp.qty - jp.reserved as need
		from public.job_card_parts jp
		where jp.job_card = p_number and not jp.picked and jp.reserved < jp.qty
		order by jp.sku
		for update
	loop
		select greatest(0, least(v_line.need, p.in_stock - p.reserved))
		into v_take
		from public.parts p
		where p.sku = v_line.sku
		for update;

		if coalesce(v_take, 0) > 0 then
			update public.parts set reserved = reserved + v_take where sku = v_line.sku;
			update public.job_card_parts
			set reserved = reserved + v_take
			where job_card = p_number and sku = v_line.sku;
		end if;
	end loop;

	v_short := exists (
		select 1 from public.job_card_parts
		where job_card = p_number and not picked and reserved < qty
	);

	-- Cutting can't start while parts are short; once they're in, it's ready
	update public.job_card_steps
	set status = case when v_short then 'blocked' else 'todo' end
	where job_card = p_number and step_index = 0 and status in ('todo', 'blocked');

	return v_short;
end;
$$;

revoke all on function public.reserve_job_card_parts(text) from public, anon;
grant execute on function public.reserve_job_card_parts(text) to authenticated;

-- Takes a fully reserved part out of stock for a job card.
create or replace function public.pick_job_card_part(p_number text, p_sku text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_line public.job_card_parts;
begin
	if not private.authorize('work_orders.edit_status') then
		raise exception 'Not allowed to change job cards' using errcode = '42501';
	end if;

	select * into v_line
	from public.job_card_parts
	where job_card = p_number and sku = p_sku
	for update;

	if v_line.job_card is null then
		raise exception 'Part % is not on job card %', p_sku, p_number;
	end if;
	if v_line.picked then
		raise exception 'Part % is already picked', p_sku;
	end if;
	if v_line.reserved < v_line.qty then
		raise exception 'Part % is not fully reserved yet', p_sku;
	end if;

	update public.parts
	set in_stock = in_stock - v_line.qty, reserved = reserved - v_line.qty
	where sku = p_sku;

	update public.job_card_parts
	set picked = true, reserved = 0
	where job_card = p_number and sku = p_sku;
end;
$$;

revoke all on function public.pick_job_card_part(text, text) from public, anon;
grant execute on function public.pick_job_card_part(text, text) to authenticated;

-- Creates a job card with its items, parts and six steps in one go, then
-- reserves its parts. Returns the new job card number.
--   p_card:  { quote_id, quote_number, client_id, client_name, items_summary, icon, due, address, note }
--   p_items: [{ name, kind, spec, qty }]
--   p_parts: [{ sku, qty }]
--   p_planned_hours: six numbers, one per step
create or replace function public.create_job_card(
	p_card jsonb,
	p_items jsonb,
	p_parts jsonb,
	p_planned_hours numeric[],
	p_prefix text default 'JC-'
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
	v_number text;
begin
	if coalesce(array_length(p_planned_hours, 1), 0) <> 6 then
		raise exception 'Planned hours are needed for all six steps';
	end if;

	v_number := p_prefix || to_char(current_date, 'YYYYMMDD') || '-'
		|| lpad(nextval('public.job_card_number_seq')::text, 4, '0');

	insert into public.job_cards (
		number, quote_id, quote_number, client_id, client_name, items_summary, icon,
		due, address, note, created_by
	)
	values (
		v_number,
		nullif(p_card ->> 'quote_id', '')::uuid,
		coalesce(p_card ->> 'quote_number', ''),
		nullif(p_card ->> 'client_id', '')::uuid,
		p_card ->> 'client_name',
		coalesce(p_card ->> 'items_summary', ''),
		coalesce(p_card ->> 'icon', 'other'),
		(p_card ->> 'due')::date,
		coalesce(p_card ->> 'address', ''),
		coalesce(p_card ->> 'note', ''),
		(select auth.uid())
	);

	insert into public.job_card_items (job_card, name, kind, spec, qty, sort_order)
	select v_number, i.name, coalesce(i.kind, 'other'), coalesce(i.spec, ''), i.qty, i.ord - 1
	from rows from (
		jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as (name text, kind text, spec text, qty integer)
	) with ordinality as i(name, kind, spec, qty, ord);

	insert into public.job_card_parts (job_card, sku, qty)
	select v_number, p.sku, p.qty
	from jsonb_to_recordset(coalesce(p_parts, '[]'::jsonb)) as p(sku text, qty numeric);

	insert into public.job_card_steps (job_card, step_index, planned_hours)
	select v_number, (s.n - 1)::smallint, coalesce(s.hours, 0)
	from unnest(p_planned_hours) with ordinality as s(hours, n);

	perform public.reserve_job_card_parts(v_number);

	return v_number;
end;
$$;

revoke all on function public.create_job_card(jsonb, jsonb, jsonb, numeric[], text) from public, anon;
grant execute on function public.create_job_card(jsonb, jsonb, jsonb, numeric[], text) to authenticated;

-- ----------------------------------------------------------------------------
-- 4. Grants & Row Level Security
-- ----------------------------------------------------------------------------
revoke all on public.machines from anon;
revoke all on public.machine_maintenance from anon;
revoke all on public.job_cards from anon;
revoke all on public.job_card_items from anon;
revoke all on public.job_card_parts from anon;
revoke all on public.job_card_steps from anon;
revoke all on public.job_card_step_machines from anon;
revoke all on public.job_card_time_entries from anon;
revoke all on public.job_card_time_entry_machines from anon;
revoke all on public.job_card_redos from anon;
revoke all on sequence public.job_card_number_seq from anon;

grant select, insert, update on public.machines to authenticated;
grant select, insert, update, delete on public.machine_maintenance to authenticated;
grant select, insert, update on public.job_cards to authenticated;
grant select, insert, update, delete on public.job_card_items to authenticated;
grant select, insert, update, delete on public.job_card_parts to authenticated;
grant select, insert, update on public.job_card_steps to authenticated;
grant select, insert, update, delete on public.job_card_step_machines to authenticated;
grant select, insert, update, delete on public.job_card_time_entries to authenticated;
grant select, insert, update, delete on public.job_card_time_entry_machines to authenticated;
grant select, insert, update, delete on public.job_card_redos to authenticated;
grant usage on sequence public.job_card_number_seq to authenticated;

alter table public.machines enable row level security;
alter table public.machine_maintenance enable row level security;
alter table public.job_cards enable row level security;
alter table public.job_card_items enable row level security;
alter table public.job_card_parts enable row level security;
alter table public.job_card_steps enable row level security;
alter table public.job_card_step_machines enable row level security;
alter table public.job_card_time_entries enable row level security;
alter table public.job_card_time_entry_machines enable row level security;
alter table public.job_card_redos enable row level security;

-- Machines
create policy "Job card or material viewers can read machines"
	on public.machines for select to authenticated
	using (
		(select private.authorize('work_orders.view'))
		or (select private.authorize('materials.view'))
	);

create policy "Production or material editors can insert machines"
	on public.machines for insert to authenticated
	with check (
		(select private.authorize('work_orders.edit_status'))
		or (select private.authorize('materials.edit'))
	);

create policy "Production or material editors can update machines"
	on public.machines for update to authenticated
	using (
		(select private.authorize('work_orders.edit_status'))
		or (select private.authorize('materials.edit'))
	)
	with check (
		(select private.authorize('work_orders.edit_status'))
		or (select private.authorize('materials.edit'))
	);

-- Machine maintenance
create policy "Job card or material viewers can read maintenance"
	on public.machine_maintenance for select to authenticated
	using (
		(select private.authorize('work_orders.view'))
		or (select private.authorize('materials.view'))
	);

create policy "Production or material editors can log maintenance"
	on public.machine_maintenance for insert to authenticated
	with check (
		(select private.authorize('work_orders.edit_status'))
		or (select private.authorize('materials.edit'))
	);

create policy "Production or material editors can update maintenance"
	on public.machine_maintenance for update to authenticated
	using (
		(select private.authorize('work_orders.edit_status'))
		or (select private.authorize('materials.edit'))
	)
	with check (
		(select private.authorize('work_orders.edit_status'))
		or (select private.authorize('materials.edit'))
	);

create policy "MD or GM can delete maintenance"
	on public.machine_maintenance for delete to authenticated
	using ((select private.current_user_role()) in ('md', 'gm'));

-- Job cards
create policy "Job card viewers can read job cards"
	on public.job_cards for select to authenticated
	using ((select private.authorize('work_orders.view')));

create policy "Job card editors can insert job cards"
	on public.job_cards for insert to authenticated
	with check ((select private.authorize('work_orders.edit_status')));

create policy "Job card editors can update job cards"
	on public.job_cards for update to authenticated
	using ((select private.authorize('work_orders.edit_status')))
	with check ((select private.authorize('work_orders.edit_status')));

-- Job card items
create policy "Job card viewers can read job card items"
	on public.job_card_items for select to authenticated
	using ((select private.authorize('work_orders.view')));

create policy "Job card editors can insert job card items"
	on public.job_card_items for insert to authenticated
	with check ((select private.authorize('work_orders.edit_status')));

create policy "Job card editors can update job card items"
	on public.job_card_items for update to authenticated
	using ((select private.authorize('work_orders.edit_status')))
	with check ((select private.authorize('work_orders.edit_status')));

create policy "Job card editors can delete job card items"
	on public.job_card_items for delete to authenticated
	using ((select private.authorize('work_orders.edit_status')));

-- Job card parts (reserved/picked change through the functions above)
create policy "Job card viewers can read job card parts"
	on public.job_card_parts for select to authenticated
	using ((select private.authorize('work_orders.view')));

create policy "Job card editors can insert job card parts"
	on public.job_card_parts for insert to authenticated
	with check ((select private.authorize('work_orders.edit_status')) and reserved = 0 and not picked);

create policy "Job card editors can delete unreserved job card parts"
	on public.job_card_parts for delete to authenticated
	using ((select private.authorize('work_orders.edit_status')) and reserved = 0 and not picked);

-- Job card steps
create policy "Job card viewers can read job card steps"
	on public.job_card_steps for select to authenticated
	using ((select private.authorize('work_orders.view')));

create policy "Job card editors can insert job card steps"
	on public.job_card_steps for insert to authenticated
	with check ((select private.authorize('work_orders.edit_status')));

create policy "Job card editors can update job card steps"
	on public.job_card_steps for update to authenticated
	using ((select private.authorize('work_orders.edit_status')))
	with check ((select private.authorize('work_orders.edit_status')));

-- Planned machine time
create policy "Job card viewers can read planned machine time"
	on public.job_card_step_machines for select to authenticated
	using ((select private.authorize('work_orders.view')));

create policy "Job card editors can insert planned machine time"
	on public.job_card_step_machines for insert to authenticated
	with check ((select private.authorize('work_orders.edit_status')));

create policy "Job card editors can update planned machine time"
	on public.job_card_step_machines for update to authenticated
	using ((select private.authorize('work_orders.edit_status')))
	with check ((select private.authorize('work_orders.edit_status')));

create policy "Job card editors can delete planned machine time"
	on public.job_card_step_machines for delete to authenticated
	using ((select private.authorize('work_orders.edit_status')));

-- Time entries
create policy "Job card viewers can read time entries"
	on public.job_card_time_entries for select to authenticated
	using ((select private.authorize('work_orders.view')));

create policy "Job card editors can log time"
	on public.job_card_time_entries for insert to authenticated
	with check ((select private.authorize('work_orders.edit_status')));

create policy "Job card editors can update time entries"
	on public.job_card_time_entries for update to authenticated
	using ((select private.authorize('work_orders.edit_status')))
	with check ((select private.authorize('work_orders.edit_status')));

create policy "Job card editors can delete time entries"
	on public.job_card_time_entries for delete to authenticated
	using ((select private.authorize('work_orders.edit_status')));

-- Machine time within time entries
create policy "Job card viewers can read machine time"
	on public.job_card_time_entry_machines for select to authenticated
	using (
		(select private.authorize('work_orders.view'))
		or (select private.authorize('materials.view'))
	);

create policy "Job card editors can log machine time"
	on public.job_card_time_entry_machines for insert to authenticated
	with check ((select private.authorize('work_orders.edit_status')));

create policy "Job card editors can update machine time"
	on public.job_card_time_entry_machines for update to authenticated
	using ((select private.authorize('work_orders.edit_status')))
	with check ((select private.authorize('work_orders.edit_status')));

create policy "Job card editors can delete machine time"
	on public.job_card_time_entry_machines for delete to authenticated
	using ((select private.authorize('work_orders.edit_status')));

-- Redos
create policy "Job card viewers can read redos"
	on public.job_card_redos for select to authenticated
	using ((select private.authorize('work_orders.view')));

create policy "Job card editors can record redos"
	on public.job_card_redos for insert to authenticated
	with check ((select private.authorize('work_orders.edit_status')));

create policy "Job card editors can update redos"
	on public.job_card_redos for update to authenticated
	using ((select private.authorize('work_orders.edit_status')))
	with check ((select private.authorize('work_orders.edit_status')));

create policy "Job card editors can delete redos"
	on public.job_card_redos for delete to authenticated
	using ((select private.authorize('work_orders.edit_status')));
