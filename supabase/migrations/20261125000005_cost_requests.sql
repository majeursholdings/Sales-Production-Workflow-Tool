-- ============================================================================
-- Cost requests: custom designs the parts agent couldn't fully match, sent to
-- procurement to check and price before the line can go on a quote.
--
-- Who does what:
--   * Raise a request (from the quote builder's custom design flow):
--     quotes.create (md, gm, sales). Requesters can read their own requests.
--   * Review, ask questions, approve, decline, reopen: materials.edit
--     (md, gm, procurement), matching the /cost-requests route.
--   * Messages: the reviewers above, or the request's own requester (replies).
-- ============================================================================

create sequence public.cost_request_number_seq;

-- ----------------------------------------------------------------------------
-- 1. Requests
-- ----------------------------------------------------------------------------
create table public.cost_requests (
	id text primary key
		default ('CR-' || lpad(nextval('public.cost_request_number_seq')::text, 4, '0')),
	title text not null check (length(trim(title)) > 0),
	-- "New piece", or what it adds to, e.g. "Addition to side table"
	target text not null default 'New piece',
	new_piece boolean not null default true,
	client_id uuid references public.clients (id) on delete set null,
	client_name text not null,
	quote_id uuid references public.quotes (id) on delete set null,
	quote_number text not null,
	requested_by uuid default auth.uid() references auth.users (id) on delete set null,
	requested_by_name text not null,
	requested_at timestamptz not null default now(),
	needed_by date not null,
	size text not null default '',
	quantity integer not null default 1 check (quantity > 0),
	markup_percent numeric(6, 2) not null default 0 check (markup_percent >= 0),
	markup_category text not null default '',
	notes text not null default '',
	status text not null default 'open' check (status in ('open', 'approved', 'declined')),
	decline_reason text check (decline_reason in ('nosupplier', 'deadline', 'cost', 'material')),
	alternative text,
	save_as_type boolean not null default false,
	approved_by uuid references auth.users (id) on delete set null,
	approved_by_name text,
	approved_cost numeric(14, 2) check (approved_cost >= 0),
	resolved_at timestamptz,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	constraint declined_has_reason check (status <> 'declined' or decline_reason is not null),
	constraint approved_has_cost check (status <> 'approved' or approved_cost is not null)
);

alter sequence public.cost_request_number_seq owned by public.cost_requests.id;

comment on table public.cost_requests is 'Custom designs the parts agent could not fully match; procurement checks and prices them before they can be quoted.';

create index cost_requests_client_id_idx on public.cost_requests (client_id);
create index cost_requests_quote_id_idx on public.cost_requests (quote_id);
create index cost_requests_requested_by_idx on public.cost_requests (requested_by);
create index cost_requests_approved_by_idx on public.cost_requests (approved_by);
create index cost_requests_status_requested_at_idx on public.cost_requests (status, requested_at desc);

create trigger cost_requests_set_updated_at
	before update on public.cost_requests
	for each row execute function private.set_updated_at();

-- ----------------------------------------------------------------------------
-- 2. Photos the requester sent
-- ----------------------------------------------------------------------------
create table public.cost_request_images (
	id uuid primary key default gen_random_uuid(),
	request_id text not null references public.cost_requests (id) on delete cascade,
	position integer not null default 0,
	src text not null,
	alt text not null default ''
);

comment on table public.cost_request_images is 'Photos and mock-ups attached to a cost request.';

create index cost_request_images_request_id_idx on public.cost_request_images (request_id, position);

-- ----------------------------------------------------------------------------
-- 3. Parts the agent matched, and how procurement settled each flagged one
-- ----------------------------------------------------------------------------
create table public.cost_request_parts (
	id uuid primary key default gen_random_uuid(),
	request_id text not null references public.cost_requests (id) on delete cascade,
	position integer not null default 0,
	name text not null,
	-- Inventory SKU the agent matched; null when the part isn't in inventory
	sku text references public.parts (sku) on update cascade on delete set null,
	use text not null default '',
	qty numeric(12, 2) not null check (qty > 0),
	unit_cost numeric(14, 2) not null default 0 check (unit_cost >= 0),
	confidence smallint not null check (confidence between 0 and 100),
	kind text not null default 'stock' check (kind in ('stock', 'missing', 'priced')),
	note text,
	pin_x numeric(5, 2) check (pin_x between 0 and 100),
	pin_y numeric(5, 2) check (pin_y between 0 and 100),
	doubt text,
	asked_to_add boolean not null default false,
	-- One-off price the agent suggests from similar work, for a missing part
	suggested_unit_cost numeric(14, 2) check (suggested_unit_cost >= 0),
	suggested_supplier_id text references public.suppliers (id) on delete set null,
	suggested_lead_days integer check (suggested_lead_days >= 0),
	-- Procurement's resolution
	resolution text check (resolution in ('keep', 'drop', 'sub', 'oneOff')),
	substitute_id uuid,
	one_off_unit_cost numeric(14, 2) check (one_off_unit_cost >= 0),
	one_off_supplier_id text references public.suppliers (id) on delete set null,
	one_off_lead_days integer check (one_off_lead_days >= 0),
	add_to_inventory boolean not null default false,
	-- The inventory part created from a one-off price, when it was added
	added_sku text references public.parts (sku) on update cascade on delete set null,
	constraint pin_both_or_none check ((pin_x is null) = (pin_y is null)),
	constraint sub_has_substitute check (resolution is distinct from 'sub' or substitute_id is not null)
);

comment on table public.cost_request_parts is 'The parts agent''s parts list for a cost request, with procurement''s resolution of each flagged part.';

create index cost_request_parts_request_id_idx on public.cost_request_parts (request_id, position);
create index cost_request_parts_sku_idx on public.cost_request_parts (sku);
create index cost_request_parts_suggested_supplier_id_idx on public.cost_request_parts (suggested_supplier_id);
create index cost_request_parts_one_off_supplier_id_idx on public.cost_request_parts (one_off_supplier_id);
create index cost_request_parts_added_sku_idx on public.cost_request_parts (added_sku);
create index cost_request_parts_substitute_id_idx on public.cost_request_parts (substitute_id);

create table public.cost_request_substitutes (
	id uuid primary key default gen_random_uuid(),
	part_id uuid not null references public.cost_request_parts (id) on delete cascade,
	position integer not null default 0,
	name text not null,
	sku text not null references public.parts (sku) on update cascade on delete cascade,
	qty numeric(12, 2) not null check (qty > 0),
	unit_cost numeric(14, 2) not null check (unit_cost >= 0),
	why text not null default ''
);

comment on table public.cost_request_substitutes is 'Inventory parts the agent suggests instead of a part that is not in inventory.';

create index cost_request_substitutes_part_id_idx on public.cost_request_substitutes (part_id, position);
create index cost_request_substitutes_sku_idx on public.cost_request_substitutes (sku);

alter table public.cost_request_parts
	add constraint cost_request_parts_substitute_id_fkey
	foreign key (substitute_id) references public.cost_request_substitutes (id) on delete set null;

-- ----------------------------------------------------------------------------
-- 4. Questions and replies between procurement and the requester
-- ----------------------------------------------------------------------------
create table public.cost_request_messages (
	id bigint generated always as identity primary key,
	request_id text not null references public.cost_requests (id) on delete cascade,
	author_id uuid default auth.uid() references auth.users (id) on delete set null,
	author_name text not null,
	body text not null check (length(trim(body)) > 0),
	created_at timestamptz not null default now()
);

comment on table public.cost_request_messages is 'Questions procurement asks about a cost request, and the requester''s replies.';

create index cost_request_messages_request_id_idx on public.cost_request_messages (request_id, created_at);
create index cost_request_messages_author_id_idx on public.cost_request_messages (author_id);

-- ----------------------------------------------------------------------------
-- 5. Raise a request with its photos, parts and substitutes in one go
-- ----------------------------------------------------------------------------
-- p_request: { title, target, new_piece, client_id, client_name, quote_id,
--   quote_number, requested_by_name, needed_by, size, quantity, markup_percent,
--   markup_category, notes, images: [{src, alt}], parts: [{name, sku, use, qty,
--   unit_cost, confidence, kind, note, pin_x, pin_y, doubt, asked_to_add,
--   suggested_unit_cost, suggested_supplier_id, suggested_lead_days,
--   substitutes: [{name, sku, qty, unit_cost, why}]}] }
create or replace function public.create_cost_request(p_request jsonb)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
	v_id text;
	v_part_id uuid;
	v_part jsonb;
	v_part_pos bigint;
begin
	insert into public.cost_requests (
		title, target, new_piece, client_id, client_name, quote_id, quote_number,
		requested_by, requested_by_name, needed_by, size, quantity,
		markup_percent, markup_category, notes
	)
	values (
		p_request ->> 'title',
		coalesce(p_request ->> 'target', 'New piece'),
		coalesce((p_request ->> 'new_piece')::boolean, true),
		(p_request ->> 'client_id')::uuid,
		p_request ->> 'client_name',
		(p_request ->> 'quote_id')::uuid,
		p_request ->> 'quote_number',
		(select auth.uid()),
		p_request ->> 'requested_by_name',
		(p_request ->> 'needed_by')::date,
		coalesce(p_request ->> 'size', ''),
		coalesce((p_request ->> 'quantity')::integer, 1),
		coalesce((p_request ->> 'markup_percent')::numeric, 0),
		coalesce(p_request ->> 'markup_category', ''),
		coalesce(p_request ->> 'notes', '')
	)
	returning id into v_id;

	insert into public.cost_request_images (request_id, position, src, alt)
	select v_id, i.pos - 1, i.img ->> 'src', coalesce(i.img ->> 'alt', '')
	from jsonb_array_elements(coalesce(p_request -> 'images', '[]'::jsonb)) with ordinality as i (img, pos);

	for v_part, v_part_pos in
		select p.part, p.pos
		from jsonb_array_elements(coalesce(p_request -> 'parts', '[]'::jsonb)) with ordinality as p (part, pos)
	loop
		insert into public.cost_request_parts (
			request_id, position, name, sku, use, qty, unit_cost, confidence, kind, note,
			pin_x, pin_y, doubt, asked_to_add,
			suggested_unit_cost, suggested_supplier_id, suggested_lead_days
		)
		values (
			v_id,
			v_part_pos - 1,
			v_part ->> 'name',
			v_part ->> 'sku',
			coalesce(v_part ->> 'use', ''),
			(v_part ->> 'qty')::numeric,
			coalesce((v_part ->> 'unit_cost')::numeric, 0),
			(v_part ->> 'confidence')::smallint,
			coalesce(v_part ->> 'kind', 'stock'),
			v_part ->> 'note',
			(v_part ->> 'pin_x')::numeric,
			(v_part ->> 'pin_y')::numeric,
			v_part ->> 'doubt',
			coalesce((v_part ->> 'asked_to_add')::boolean, false),
			(v_part ->> 'suggested_unit_cost')::numeric,
			v_part ->> 'suggested_supplier_id',
			(v_part ->> 'suggested_lead_days')::integer
		)
		returning id into v_part_id;

		insert into public.cost_request_substitutes (part_id, position, name, sku, qty, unit_cost, why)
		select
			v_part_id,
			s.pos - 1,
			s.sub ->> 'name',
			s.sub ->> 'sku',
			(s.sub ->> 'qty')::numeric,
			(s.sub ->> 'unit_cost')::numeric,
			coalesce(s.sub ->> 'why', '')
		from jsonb_array_elements(coalesce(v_part -> 'substitutes', '[]'::jsonb)) with ordinality as s (sub, pos);
	end loop;

	return v_id;
end;
$$;

revoke all on function public.create_cost_request(jsonb) from public, anon;
grant execute on function public.create_cost_request(jsonb) to authenticated;

-- ----------------------------------------------------------------------------
-- 6. Approve a request: save each flagged part's resolution, add any one-off
--    parts procurement chose to stock, and mark it approved, atomically.
-- ----------------------------------------------------------------------------
-- p_resolutions: [{ part_id, resolution, substitute_id, one_off_unit_cost,
--   one_off_supplier_id, one_off_lead_days, add_to_inventory, added_sku }]
-- p_new_parts: [{ sku, name, category, unit, unit_cost, supplier_id, lead_days }]
create or replace function public.approve_cost_request(
	p_id text,
	p_cost numeric,
	p_save_as_type boolean,
	p_approver_name text,
	p_resolutions jsonb,
	p_new_parts jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
	v_status text;
	v_new jsonb;
begin
	if not (select private.authorize('materials.edit')) then
		raise exception 'Not allowed to approve cost requests' using errcode = '42501';
	end if;

	select status into v_status
	from public.cost_requests
	where id = p_id
	for update;

	if v_status is null then
		raise exception 'Cost request % not found', p_id;
	end if;
	if v_status <> 'open' then
		raise exception 'Cost request % is already closed', p_id;
	end if;

	for v_new in select value from jsonb_array_elements(coalesce(p_new_parts, '[]'::jsonb))
	loop
		insert into public.parts (sku, name, category, unit, unit_cost, cost_updated_by, supplier_id, notes)
		values (
			v_new ->> 'sku',
			v_new ->> 'name',
			v_new ->> 'category',
			v_new ->> 'unit',
			(v_new ->> 'unit_cost')::numeric,
			p_approver_name,
			nullif(v_new ->> 'supplier_id', ''),
			'Added from cost request ' || p_id
		);

		if nullif(v_new ->> 'supplier_id', '') is not null then
			insert into public.supplier_materials (supplier_id, sku, price, lead_days)
			values (
				v_new ->> 'supplier_id',
				v_new ->> 'sku',
				(v_new ->> 'unit_cost')::numeric,
				coalesce((v_new ->> 'lead_days')::integer, 5)
			)
			on conflict (supplier_id, sku) do nothing;
		end if;
	end loop;

	update public.cost_request_parts as p
	set
		resolution = r.resolution,
		substitute_id = r.substitute_id,
		one_off_unit_cost = r.one_off_unit_cost,
		one_off_supplier_id = nullif(r.one_off_supplier_id, ''),
		one_off_lead_days = r.one_off_lead_days,
		add_to_inventory = coalesce(r.add_to_inventory, false),
		added_sku = r.added_sku
	from jsonb_to_recordset(coalesce(p_resolutions, '[]'::jsonb)) as r (
		part_id uuid,
		resolution text,
		substitute_id uuid,
		one_off_unit_cost numeric,
		one_off_supplier_id text,
		one_off_lead_days integer,
		add_to_inventory boolean,
		added_sku text
	)
	where p.id = r.part_id and p.request_id = p_id;

	update public.cost_requests
	set
		status = 'approved',
		approved_by = (select auth.uid()),
		approved_by_name = p_approver_name,
		approved_cost = p_cost,
		save_as_type = coalesce(p_save_as_type, false),
		resolved_at = now(),
		decline_reason = null,
		alternative = null
	where id = p_id;
end;
$$;

revoke all on function public.approve_cost_request(text, numeric, boolean, text, jsonb, jsonb) from public, anon;
grant execute on function public.approve_cost_request(text, numeric, boolean, text, jsonb, jsonb) to authenticated;

-- ----------------------------------------------------------------------------
-- 7. Grants & Row Level Security
-- ----------------------------------------------------------------------------
revoke all on public.cost_requests from anon;
revoke all on public.cost_request_images from anon;
revoke all on public.cost_request_parts from anon;
revoke all on public.cost_request_substitutes from anon;
revoke all on public.cost_request_messages from anon;
revoke all on sequence public.cost_request_number_seq from anon;

grant select, insert, update on public.cost_requests to authenticated;
grant select, insert on public.cost_request_images to authenticated;
grant select, insert, update on public.cost_request_parts to authenticated;
grant select, insert on public.cost_request_substitutes to authenticated;
grant select, insert on public.cost_request_messages to authenticated;
grant usage on sequence public.cost_request_number_seq to authenticated;

alter table public.cost_requests enable row level security;
alter table public.cost_request_images enable row level security;
alter table public.cost_request_parts enable row level security;
alter table public.cost_request_substitutes enable row level security;
alter table public.cost_request_messages enable row level security;

-- Requests
create policy "Reviewers and the requester can read cost requests"
	on public.cost_requests for select to authenticated
	using (
		(select private.authorize('materials.edit'))
		or requested_by = (select auth.uid())
	);

create policy "Quote makers can raise their own cost requests"
	on public.cost_requests for insert to authenticated
	with check (
		(select private.authorize('quotes.create'))
		and requested_by = (select auth.uid())
		and status = 'open'
	);

create policy "Reviewers can update cost requests"
	on public.cost_requests for update to authenticated
	using ((select private.authorize('materials.edit')))
	with check ((select private.authorize('materials.edit')));

-- Child rows are readable whenever their request is (the subquery runs under the request's RLS)
create policy "Readers of a request can read its images"
	on public.cost_request_images for select to authenticated
	using (exists (select 1 from public.cost_requests r where r.id = request_id));

create policy "Requesters can add images to their open requests"
	on public.cost_request_images for insert to authenticated
	with check (
		(select private.authorize('quotes.create'))
		and exists (
			select 1 from public.cost_requests r
			where r.id = request_id and r.requested_by = (select auth.uid()) and r.status = 'open'
		)
	);

create policy "Readers of a request can read its parts"
	on public.cost_request_parts for select to authenticated
	using (exists (select 1 from public.cost_requests r where r.id = request_id));

create policy "Requesters can add parts to their open requests"
	on public.cost_request_parts for insert to authenticated
	with check (
		(select private.authorize('quotes.create'))
		and exists (
			select 1 from public.cost_requests r
			where r.id = request_id and r.requested_by = (select auth.uid()) and r.status = 'open'
		)
	);

create policy "Reviewers can resolve request parts"
	on public.cost_request_parts for update to authenticated
	using ((select private.authorize('materials.edit')))
	with check ((select private.authorize('materials.edit')));

create policy "Readers of a request can read its substitutes"
	on public.cost_request_substitutes for select to authenticated
	using (exists (select 1 from public.cost_request_parts p where p.id = part_id));

create policy "Requesters can add substitutes to their open requests"
	on public.cost_request_substitutes for insert to authenticated
	with check (
		(select private.authorize('quotes.create'))
		and exists (
			select 1
			from public.cost_request_parts p
			join public.cost_requests r on r.id = p.request_id
			where p.id = part_id and r.requested_by = (select auth.uid()) and r.status = 'open'
		)
	);

-- Messages
create policy "Readers of a request can read its messages"
	on public.cost_request_messages for select to authenticated
	using (exists (select 1 from public.cost_requests r where r.id = request_id));

create policy "Reviewers and the requester can post on open requests"
	on public.cost_request_messages for insert to authenticated
	with check (
		author_id = (select auth.uid())
		and exists (
			select 1 from public.cost_requests r
			where r.id = request_id
				and r.status = 'open'
				and (
					(select private.authorize('materials.edit'))
					or r.requested_by = (select auth.uid())
				)
		)
	);
