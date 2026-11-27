-- ============================================================================
-- Country-aware addresses on clients, suppliers and job cards.
--
-- Each keeps its written-out text column (clients.location, suppliers.address,
-- job_cards.address) for tables, documents, invoices and search, and gains
-- address_parts: {country (ISO alpha-2), street, area, city, state,
-- postalCode, sortingCode, landmark}. Null until the address is next saved
-- through the new form; the form starts old addresses off in the street line.
-- ============================================================================

alter table public.clients
	add column if not exists address_parts jsonb
		check (address_parts is null or jsonb_typeof(address_parts) = 'object');

alter table public.suppliers
	add column if not exists address_parts jsonb
		check (address_parts is null or jsonb_typeof(address_parts) = 'object');

alter table public.job_cards
	add column if not exists address_parts jsonb
		check (address_parts is null or jsonb_typeof(address_parts) = 'object');

comment on column public.clients.address_parts is
	'The client''s delivery address in parts; `location` holds it written out.';
comment on column public.suppliers.address_parts is
	'The supplier''s address in parts; `address` holds it written out and `area` its city and state.';
comment on column public.job_cards.address_parts is
	'The delivery address in parts; `address` holds it written out.';
