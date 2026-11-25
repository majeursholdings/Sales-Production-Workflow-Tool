-- ============================================================================
-- Procurement: Suppliers, Parts (inventory), Supplier materials, Purchase orders
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Suppliers
-- ----------------------------------------------------------------------------
create table public.suppliers (
	id text primary key,
	business text not null,
	contact text not null default '',
	address text not null default '',
	area text not null default '',
	phone text not null default '',
	email text not null default '',
	bank_name text not null default '',
	account_number text not null default '',
	account_name text not null default '',
	notes text not null default '',
	since date not null default current_date,
	is_active boolean not null default true,
	created_by uuid references auth.users (id) on delete set null,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

comment on table public.suppliers is 'Businesses we buy materials from. Deleting a supplier deactivates it so past POs keep its name.';

create index suppliers_created_by_idx on public.suppliers (created_by);

create trigger suppliers_set_updated_at
	before update on public.suppliers
	for each row execute function private.set_updated_at();

-- ----------------------------------------------------------------------------
-- 2. Parts (inventory) — also the list of materials suppliers can sell us
-- ----------------------------------------------------------------------------
create table public.parts (
	sku text primary key,
	name text not null,
	category text not null,
	unit text not null,
	spec text not null default '',
	unit_cost numeric(14, 2) not null default 0 check (unit_cost >= 0),
	cost_updated_on date not null default current_date,
	cost_updated_by text not null default '',
	in_stock numeric(12, 2) not null default 0 check (in_stock >= 0),
	reserved numeric(12, 2) not null default 0 check (reserved >= 0),
	reorder_level numeric(12, 2) not null default 0 check (reorder_level >= 0),
	supplier_id text references public.suppliers (id) on delete set null,
	notes text not null default '',
	photo_url text,
	is_archived boolean not null default false,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

comment on table public.parts is 'Inventory parts/materials with stock levels and unit cost used in quotes.';

create index parts_supplier_id_idx on public.parts (supplier_id);
create index parts_active_idx on public.parts (name) where is_archived = false;

create trigger parts_set_updated_at
	before update on public.parts
	for each row execute function private.set_updated_at();

-- ----------------------------------------------------------------------------
-- 3. Supplier materials: one supplier's price, terms and ratings for one part
-- ----------------------------------------------------------------------------
create table public.supplier_materials (
	supplier_id text not null references public.suppliers (id) on delete cascade,
	sku text not null references public.parts (sku) on update cascade on delete cascade,
	price numeric(14, 2) not null check (price >= 0),
	lead_days integer not null default 5 check (lead_days >= 0),
	min_order text not null default '',
	quality smallint check (quality between 1 and 5),
	reliability smallint check (reliability between 1 and 5),
	availability smallint check (availability between 1 and 5),
	rated_on date,
	rated_by text,
	rating_note text not null default '',
	is_preferred boolean not null default false,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	primary key (supplier_id, sku),
	constraint ratings_all_or_none check (
		(quality is null and reliability is null and availability is null)
		or (quality is not null and reliability is not null and availability is not null)
	)
);

comment on table public.supplier_materials is 'Materials each supplier sells us, with price, lead time and procurement ratings.';

create index supplier_materials_sku_idx on public.supplier_materials (sku);
-- At most one preferred supplier per material
create unique index supplier_materials_one_preferred_idx
	on public.supplier_materials (sku) where is_preferred;

create trigger supplier_materials_set_updated_at
	before update on public.supplier_materials
	for each row execute function private.set_updated_at();

-- ----------------------------------------------------------------------------
-- 4. Purchase orders & lines
-- ----------------------------------------------------------------------------
create table public.purchase_orders (
	number text primary key,
	order_date date not null default current_date,
	raised_by text not null,
	raised_by_id uuid references auth.users (id) on delete set null,
	supplier_id text not null references public.suppliers (id) on delete restrict,
	status text not null default 'draft'
		check (status in ('draft', 'approval', 'sent', 'part', 'received')),
	expected date,
	delivered_on date,
	quality text check (quality in ('As ordered', 'Minor issues', 'Rejected some')),
	approval_requested_at timestamptz,
	approved_by uuid references auth.users (id) on delete set null,
	job_card text,
	client text,
	deliver_to text not null default '',
	payment_terms text not null default '',
	note text not null default '',
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

comment on table public.purchase_orders is 'Orders raised with suppliers. Orders over the approval limit need MD or GM approval.';

create index purchase_orders_supplier_id_idx on public.purchase_orders (supplier_id);
create index purchase_orders_raised_by_id_idx on public.purchase_orders (raised_by_id);
create index purchase_orders_approved_by_idx on public.purchase_orders (approved_by);
create index purchase_orders_order_date_idx on public.purchase_orders (order_date desc);

create trigger purchase_orders_set_updated_at
	before update on public.purchase_orders
	for each row execute function private.set_updated_at();

create table public.purchase_order_lines (
	po_number text not null references public.purchase_orders (number) on delete cascade,
	sku text not null references public.parts (sku) on update cascade on delete restrict,
	name text not null,
	unit text not null,
	ordered numeric(12, 2) not null check (ordered > 0),
	received numeric(12, 2) not null default 0 check (received >= 0),
	unit_cost numeric(14, 2) not null check (unit_cost >= 0),
	primary key (po_number, sku)
);

comment on table public.purchase_order_lines is 'Parts on a purchase order, with quantity ordered and received so far.';

create index purchase_order_lines_sku_idx on public.purchase_order_lines (sku);

-- ----------------------------------------------------------------------------
-- 5. Record a delivery atomically: update lines + PO status, add stock
-- ----------------------------------------------------------------------------
create or replace function public.record_po_delivery(
	p_number text,
	p_received jsonb,
	p_delivered_on date,
	p_quality text
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
	v_status text;
	v_item record;
begin
	select status into v_status
	from public.purchase_orders
	where number = p_number
	for update;

	if v_status is null then
		raise exception 'Purchase order % not found', p_number;
	end if;
	if v_status not in ('sent', 'part') then
		raise exception 'Purchase order % is not awaiting delivery', p_number;
	end if;

	for v_item in
		select key as sku, value::numeric as qty
		from jsonb_each_text(p_received)
		where value::numeric > 0
	loop
		update public.purchase_order_lines
		set received = received + v_item.qty
		where po_number = p_number and sku = v_item.sku;

		update public.parts
		set in_stock = in_stock + v_item.qty
		where sku = v_item.sku;
	end loop;

	v_status := case
		when exists (
			select 1 from public.purchase_order_lines
			where po_number = p_number and received < ordered
		) then 'part'
		else 'received'
	end;

	update public.purchase_orders
	set status = v_status, delivered_on = p_delivered_on, quality = p_quality
	where number = p_number;

	return v_status;
end;
$$;

revoke all on function public.record_po_delivery(text, jsonb, date, text) from public, anon;
grant execute on function public.record_po_delivery(text, jsonb, date, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 6. Grants & Row Level Security
-- ----------------------------------------------------------------------------
revoke all on public.suppliers from anon;
revoke all on public.parts from anon;
revoke all on public.supplier_materials from anon;
revoke all on public.purchase_orders from anon;
revoke all on public.purchase_order_lines from anon;

grant select, insert, update on public.suppliers to authenticated;
grant select, insert, update on public.parts to authenticated;
grant select, insert, update, delete on public.supplier_materials to authenticated;
grant select, insert, update, delete on public.purchase_orders to authenticated;
grant select, insert, update, delete on public.purchase_order_lines to authenticated;

alter table public.suppliers enable row level security;
alter table public.parts enable row level security;
alter table public.supplier_materials enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_lines enable row level security;

-- Suppliers
create policy "Material viewers can read suppliers"
	on public.suppliers for select to authenticated
	using ((select private.authorize('materials.view')));

create policy "Material editors can insert suppliers"
	on public.suppliers for insert to authenticated
	with check ((select private.authorize('materials.edit')));

create policy "Material editors can update suppliers"
	on public.suppliers for update to authenticated
	using ((select private.authorize('materials.edit')))
	with check ((select private.authorize('materials.edit')));

-- Parts
create policy "Material viewers can read parts"
	on public.parts for select to authenticated
	using ((select private.authorize('materials.view')));

create policy "Material editors can insert parts"
	on public.parts for insert to authenticated
	with check ((select private.authorize('materials.edit')));

-- PO editors may also update parts so recorded deliveries add stock
create policy "Material or PO editors can update parts"
	on public.parts for update to authenticated
	using (
		(select private.authorize('materials.edit'))
		or (select private.authorize('purchase_orders.edit'))
	)
	with check (
		(select private.authorize('materials.edit'))
		or (select private.authorize('purchase_orders.edit'))
	);

-- Supplier materials
create policy "Material viewers can read supplier materials"
	on public.supplier_materials for select to authenticated
	using ((select private.authorize('materials.view')));

create policy "Material editors can insert supplier materials"
	on public.supplier_materials for insert to authenticated
	with check ((select private.authorize('materials.edit')));

create policy "Material editors can update supplier materials"
	on public.supplier_materials for update to authenticated
	using ((select private.authorize('materials.edit')))
	with check ((select private.authorize('materials.edit')));

create policy "Material editors can delete supplier materials"
	on public.supplier_materials for delete to authenticated
	using ((select private.authorize('materials.edit')));

-- Purchase orders
create policy "PO viewers can read purchase orders"
	on public.purchase_orders for select to authenticated
	using ((select private.authorize('purchase_orders.view')));

create policy "PO editors can insert purchase orders"
	on public.purchase_orders for insert to authenticated
	with check ((select private.authorize('purchase_orders.edit')));

create policy "PO editors can update purchase orders"
	on public.purchase_orders for update to authenticated
	using ((select private.authorize('purchase_orders.edit')))
	with check ((select private.authorize('purchase_orders.edit')));

create policy "PO editors can delete draft purchase orders"
	on public.purchase_orders for delete to authenticated
	using ((select private.authorize('purchase_orders.edit')) and status = 'draft');

-- Purchase order lines
create policy "PO viewers can read purchase order lines"
	on public.purchase_order_lines for select to authenticated
	using ((select private.authorize('purchase_orders.view')));

create policy "PO editors can insert purchase order lines"
	on public.purchase_order_lines for insert to authenticated
	with check ((select private.authorize('purchase_orders.edit')));

create policy "PO editors can update purchase order lines"
	on public.purchase_order_lines for update to authenticated
	using ((select private.authorize('purchase_orders.edit')))
	with check ((select private.authorize('purchase_orders.edit')));

create policy "PO editors can delete purchase order lines"
	on public.purchase_order_lines for delete to authenticated
	using ((select private.authorize('purchase_orders.edit')));
