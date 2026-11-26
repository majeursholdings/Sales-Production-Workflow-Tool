-- ============================================================================
-- Invoices, invoice payments and recorded expenses
--
-- Money model (what the Revenue & expenses page is built from):
--   * Money in  = public.invoice_payments (the deposit recorded on a quote, then
--                 balance / part payments recorded on the invoice).
--   * Money out = public.expenses (running costs recorded by hand: wages, rent,
--                 power, delivery, outsourced work, other)
--               + materials received on purchase orders (received qty × unit
--                 cost on public.purchase_order_lines, dated by the PO's
--                 delivered_on). Materials are never recorded as expenses, so
--                 nothing is counted twice.
-- All amounts are naira, VAT included.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Invoices: one per quote, created when the deposit is recorded. The bill-to
--    details, rates and lines are copied from the quote so the invoice never
--    changes after it's issued.
-- ----------------------------------------------------------------------------
create table public.invoices (
	number text primary key,
	quote_id uuid not null unique references public.quotes (id) on delete restrict,
	quote_number text not null,
	quote_version integer not null check (quote_version >= 1),
	client_id uuid references public.clients (id) on delete set null,
	bill_to_name text not null,
	bill_to_address text not null default '',
	bill_to_email text not null default '',
	vat_rate numeric(6, 4) not null check (vat_rate >= 0 and vat_rate <= 1),
	deposit_rate numeric(6, 4) not null check (deposit_rate >= 0 and deposit_rate <= 1),
	subtotal numeric(14, 2) not null check (subtotal >= 0),
	total numeric(14, 2) not null check (total >= 0),
	issued_at timestamptz not null default now(),
	created_by uuid references auth.users (id) on delete set null,
	created_by_name text not null default '',
	created_by_role text not null default '',
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

comment on table public.invoices is 'Client invoices, one per quote, issued when the deposit is recorded. Bill-to, rates and totals are frozen at issue.';

create index invoices_client_id_idx on public.invoices (client_id);
create index invoices_created_by_idx on public.invoices (created_by);
create index invoices_issued_at_idx on public.invoices (issued_at desc);

create trigger invoices_set_updated_at
	before update on public.invoices
	for each row execute function private.set_updated_at();

create table public.invoice_lines (
	id uuid primary key default gen_random_uuid(),
	invoice_number text not null references public.invoices (number) on delete cascade,
	name text not null,
	description text not null default '',
	quantity numeric(10, 2) not null check (quantity > 0),
	unit_price numeric(14, 2) not null check (unit_price >= 0),
	sort_order integer not null default 0
);

comment on table public.invoice_lines is 'Line items copied from the quote version the invoice was issued against.';

create index invoice_lines_invoice_number_idx on public.invoice_lines (invoice_number);

-- ----------------------------------------------------------------------------
-- 2. Invoice payments (money in). Append-only.
-- ----------------------------------------------------------------------------
create table public.invoice_payments (
	id uuid primary key default gen_random_uuid(),
	invoice_number text not null references public.invoices (number) on delete cascade,
	kind text not null check (kind in ('deposit', 'balance', 'part')),
	amount numeric(14, 2) not null check (amount > 0),
	paid_on date not null,
	method text not null default 'transfer' check (method in ('transfer', 'cash', 'pos')),
	reference text not null default '',
	recorded_by uuid references auth.users (id) on delete set null,
	recorded_by_name text not null default '',
	created_at timestamptz not null default now()
);

comment on table public.invoice_payments is 'Client payments against invoices: the deposit, then balance or part payments. Revenue on the finance page.';

create index invoice_payments_invoice_number_idx on public.invoice_payments (invoice_number);
create index invoice_payments_recorded_by_idx on public.invoice_payments (recorded_by);
create index invoice_payments_paid_on_idx on public.invoice_payments (paid_on desc);

-- ----------------------------------------------------------------------------
-- 3. Expenses (money out that isn't materials on a purchase order)
-- ----------------------------------------------------------------------------
create table public.expenses (
	id uuid primary key default gen_random_uuid(),
	paid_on date not null,
	category text not null check (category in ('wag', 'rent', 'pow', 'del', 'out', 'oth')),
	amount numeric(14, 2) not null check (amount > 0),
	paid_to text not null check (length(trim(paid_to)) > 0),
	method text not null default 'transfer' check (method in ('transfer', 'cash', 'pos')),
	reference text not null default '',
	note text not null default '',
	recorded_by uuid references auth.users (id) on delete set null,
	recorded_by_name text not null default '',
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

comment on table public.expenses is 'Running costs recorded by hand (wages, rent, power, delivery, outsourced, other). Materials come from purchase orders instead.';

create index expenses_paid_on_idx on public.expenses (paid_on desc);
create index expenses_recorded_by_idx on public.expenses (recorded_by);

create trigger expenses_set_updated_at
	before update on public.expenses
	for each row execute function private.set_updated_at();

-- ----------------------------------------------------------------------------
-- 4. Record a deposit on a quote: issue the invoice (number unique against the
--    table), copy the lines, record the deposit payment and mark the quote paid,
--    all in one transaction.
-- ----------------------------------------------------------------------------
create or replace function public.record_quote_deposit(
	p_quote_number text,
	p_version integer,
	p_amount numeric,
	p_paid_on date,
	p_reference text default '',
	p_method text default 'transfer',
	p_actor_name text default '',
	p_actor_role text default '',
	p_prefix text default 'MAJ-INV-'
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
	v_quote public.quotes%rowtype;
	v_version_id uuid;
	v_subtotal numeric(14, 2);
	v_total numeric(14, 2);
	v_address text := '';
	v_email text := '';
	v_stamp timestamp := date_trunc('minute', now() at time zone 'Africa/Lagos');
	v_number text;
begin
	if not (select private.authorize('invoices.edit')) then
		raise exception 'You don''t have permission to record payments.' using errcode = '42501';
	end if;
	if p_amount is null or p_amount <= 0 then
		raise exception 'Enter an amount greater than 0.' using errcode = '22023';
	end if;

	select * into v_quote
	from public.quotes
	where quote_number = p_quote_number
	for update;

	if v_quote.id is null then
		raise exception 'Quote % not found.', p_quote_number using errcode = 'P0002';
	end if;
	if v_quote.status not in ('sent', 'expiring') then
		raise exception 'Quote % is not waiting for a deposit.', p_quote_number using errcode = '22023';
	end if;
	if exists (select 1 from public.invoices where quote_id = v_quote.id) then
		raise exception 'Quote % already has an invoice.', p_quote_number using errcode = '23505';
	end if;

	select id into v_version_id
	from public.quote_versions
	where quote_id = v_quote.id and version_number = p_version;

	select coalesce(sum(round(quantity * unit_price, 2)), 0) into v_subtotal
	from public.quote_lines
	where quote_version_id = v_version_id;

	if v_version_id is null or v_subtotal = 0 then
		-- No itemised lines: work back from the quote total.
		v_total := v_quote.total_ngn;
		v_subtotal := round(v_total / (1 + v_quote.vat_rate), 2);
	else
		v_total := round(v_subtotal * (1 + v_quote.vat_rate), 2);
	end if;

	if p_amount > v_total then
		raise exception 'The deposit is more than the invoice total.' using errcode = '22023';
	end if;

	if v_quote.client_id is not null then
		select location, email into v_address, v_email
		from public.clients
		where id = v_quote.client_id;
	end if;

	v_number := p_prefix || to_char(v_stamp, 'YYYYMMDD-HH24MI');
	while exists (select 1 from public.invoices where number = v_number) loop
		v_stamp := v_stamp + interval '1 minute';
		v_number := p_prefix || to_char(v_stamp, 'YYYYMMDD-HH24MI');
	end loop;

	insert into public.invoices (
		number, quote_id, quote_number, quote_version, client_id,
		bill_to_name, bill_to_address, bill_to_email,
		vat_rate, deposit_rate, subtotal, total,
		created_by, created_by_name, created_by_role
	) values (
		v_number, v_quote.id, v_quote.quote_number, p_version, v_quote.client_id,
		v_quote.client_name, coalesce(v_address, ''), coalesce(v_email, ''),
		v_quote.vat_rate, v_quote.deposit_rate, v_subtotal, v_total,
		(select auth.uid()), coalesce(p_actor_name, ''), coalesce(p_actor_role, '')
	);

	if v_version_id is not null and v_subtotal > 0 then
		insert into public.invoice_lines (invoice_number, name, description, quantity, unit_price, sort_order)
		select v_number, name, description, quantity, unit_price, sort_order
		from public.quote_lines
		where quote_version_id = v_version_id;
	end if;

	if not exists (select 1 from public.invoice_lines where invoice_number = v_number) then
		insert into public.invoice_lines (invoice_number, name, description, quantity, unit_price)
		values (
			v_number,
			coalesce(nullif(v_quote.items_summary, ''), 'Items on the quote'),
			'As quoted on ' || v_quote.quote_number || ' v' || p_version,
			1,
			v_subtotal
		);
	end if;

	insert into public.invoice_payments (
		invoice_number, kind, amount, paid_on, method, reference, recorded_by, recorded_by_name
	) values (
		v_number,
		'deposit',
		p_amount,
		coalesce(p_paid_on, (now() at time zone 'Africa/Lagos')::date),
		coalesce(p_method, 'transfer'),
		coalesce(p_reference, ''),
		(select auth.uid()),
		coalesce(p_actor_name, '')
	);

	update public.quotes set status = 'paid' where id = v_quote.id;

	return v_number;
end;
$$;

revoke all on function public.record_quote_deposit(text, integer, numeric, date, text, text, text, text, text) from public, anon;
grant execute on function public.record_quote_deposit(text, integer, numeric, date, text, text, text, text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 5. Record a payment on an invoice, never more than what's still owed.
--    Returns the balance left after the payment.
-- ----------------------------------------------------------------------------
create or replace function public.record_invoice_payment(
	p_invoice_number text,
	p_amount numeric,
	p_paid_on date,
	p_reference text default '',
	p_method text default 'transfer',
	p_actor_name text default ''
)
returns numeric
language plpgsql
security invoker
set search_path = ''
as $$
declare
	v_total numeric(14, 2);
	v_paid numeric(14, 2);
	v_balance numeric(14, 2);
begin
	if not (select private.authorize('invoices.edit')) then
		raise exception 'You don''t have permission to record payments.' using errcode = '42501';
	end if;
	if p_amount is null or p_amount <= 0 then
		raise exception 'Enter an amount greater than 0.' using errcode = '22023';
	end if;

	-- One payment at a time per invoice. (An advisory lock, because invoices
	-- aren't updatable by app roles, so SELECT ... FOR UPDATE can't see them.)
	perform pg_advisory_xact_lock(hashtext('invoice_payment:' || p_invoice_number));

	select total into v_total
	from public.invoices
	where number = p_invoice_number;

	if v_total is null then
		raise exception 'Invoice % not found.', p_invoice_number using errcode = 'P0002';
	end if;

	select coalesce(sum(amount), 0) into v_paid
	from public.invoice_payments
	where invoice_number = p_invoice_number;

	v_balance := greatest(v_total - v_paid, 0);
	if v_balance = 0 then
		raise exception 'Invoice % is already paid in full.', p_invoice_number using errcode = '22023';
	end if;
	if p_amount > v_balance then
		raise exception 'That''s more than the balance due.' using errcode = '22023';
	end if;

	insert into public.invoice_payments (
		invoice_number, kind, amount, paid_on, method, reference, recorded_by, recorded_by_name
	) values (
		p_invoice_number,
		case when p_amount >= v_balance then 'balance' else 'part' end,
		p_amount,
		p_paid_on,
		coalesce(p_method, 'transfer'),
		coalesce(p_reference, ''),
		(select auth.uid()),
		coalesce(p_actor_name, '')
	);

	return v_balance - p_amount;
end;
$$;

revoke all on function public.record_invoice_payment(text, numeric, date, text, text, text) from public, anon;
grant execute on function public.record_invoice_payment(text, numeric, date, text, text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 6. Grants & Row Level Security
-- ----------------------------------------------------------------------------
-- Revoked from authenticated too, so the grants below are exactly what app roles get
revoke all on public.invoices from anon, authenticated;
revoke all on public.invoice_lines from anon, authenticated;
revoke all on public.invoice_payments from anon, authenticated;
revoke all on public.expenses from anon, authenticated;

grant select, insert on public.invoices to authenticated;
grant select, insert on public.invoice_lines to authenticated;
grant select, insert on public.invoice_payments to authenticated;
grant select, insert, delete on public.expenses to authenticated;

alter table public.invoices enable row level security;
alter table public.invoice_lines enable row level security;
alter table public.invoice_payments enable row level security;
alter table public.expenses enable row level security;

-- Invoices: viewers read; Accounting, MD and GM issue them (through record_quote_deposit)
create policy "Invoice viewers can read invoices"
	on public.invoices for select to authenticated
	using ((select private.authorize('invoices.view')));

create policy "Invoice editors can insert invoices"
	on public.invoices for insert to authenticated
	with check ((select private.authorize('invoices.edit')));

create policy "Invoice viewers can read invoice lines"
	on public.invoice_lines for select to authenticated
	using ((select private.authorize('invoices.view')));

create policy "Invoice editors can insert invoice lines"
	on public.invoice_lines for insert to authenticated
	with check ((select private.authorize('invoices.edit')));

-- Payments: append-only
create policy "Invoice viewers can read invoice payments"
	on public.invoice_payments for select to authenticated
	using ((select private.authorize('invoices.view')));

create policy "Invoice editors can insert invoice payments"
	on public.invoice_payments for insert to authenticated
	with check ((select private.authorize('invoices.edit')));

-- Expenses: the finance roles (MD, GM, Accounting)
create policy "Finance roles can read expenses"
	on public.expenses for select to authenticated
	using ((select private.authorize('costs.view_full')));

create policy "Finance roles can insert expenses"
	on public.expenses for insert to authenticated
	with check ((select private.authorize('costs.view_full')));

create policy "Finance roles can delete expenses"
	on public.expenses for delete to authenticated
	using ((select private.authorize('costs.view_full')));
