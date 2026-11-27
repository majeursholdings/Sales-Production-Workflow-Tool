-- ============================================================================
-- Company addresses: one list, broken into country-aware parts, used for both
-- the address printed on documents and where purchase orders are delivered.
--
--   addresses            [{id, name, country, street, area, city, state,
--                          postalCode, sortingCode, landmark}], first one is
--                          the default delivery address on new orders.
--   document_address_id  which of them is printed on documents. The `address`
--                        column keeps it written out, for documents to read.
--
-- Replaces delivery_addresses (added in 20261127000002, never pushed).
-- Existing free-text addresses move into `street`; split them up in Settings.
-- ============================================================================

alter table public.company_settings
	add column if not exists addresses jsonb not null default '[]'::jsonb
		check (jsonb_typeof(addresses) = 'array'),
	add column if not exists document_address_id text;

comment on column public.company_settings.addresses is
	'The company''s addresses, in order: [{id, name, country (ISO alpha-2), street, area, city, state, postalCode, sortingCode, landmark}]. The first is the default purchase order delivery address.';
comment on column public.company_settings.document_address_id is
	'Id of the address in `addresses` printed on documents; `address` holds it written out.';

-- Carry over what was there: the document address first, then delivery addresses.
update public.company_settings cs
set
	addresses = moved.list,
	document_address_id = case when btrim(cs.address) <> '' then 'main' end
from (
	select
		s.id,
		coalesce(
			jsonb_agg(entry order by ord) filter (where entry is not null),
			'[]'::jsonb
		) as list
	from public.company_settings s
	left join lateral (
		select 0 as ord, jsonb_build_object(
			'id', 'main', 'name', 'Showroom and workshop', 'country', 'NG',
			'street', btrim(s.address), 'area', '', 'city', '', 'state', '',
			'postalCode', '', 'sortingCode', '', 'landmark', ''
		) as entry
		where btrim(s.address) <> ''
		union all
		select d.ord, jsonb_build_object(
			'id', gen_random_uuid()::text, 'name', d.value ->> 'name', 'country', 'NG',
			'street', coalesce(d.value ->> 'address', ''), 'area', '', 'city', '', 'state', '',
			'postalCode', '', 'sortingCode', '', 'landmark', ''
		)
		from jsonb_array_elements(s.delivery_addresses) with ordinality as d(value, ord)
		where coalesce(d.value ->> 'name', '') <> ''
	) moved_rows on true
	group by s.id
) moved
where cs.id = moved.id
	and jsonb_array_length(cs.addresses) = 0;

alter table public.company_settings drop column if exists delivery_addresses;

alter table public.company_settings_changes
	drop constraint if exists company_settings_changes_section_check;

alter table public.company_settings_changes
	add constraint company_settings_changes_section_check check (
		section in (
			'company', 'sign_in', 'bank', 'terms', 'numbering', 'tax', 'dollar',
			'trade', 'discount', 'agent', 'sending', 'delivery', 'addresses'
		)
	);
