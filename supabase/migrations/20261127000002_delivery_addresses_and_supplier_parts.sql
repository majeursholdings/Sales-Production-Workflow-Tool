-- ============================================================================
-- 1. Delivery addresses for purchase orders (Settings → Company details).
--    Stored on the company_settings singleton as [{name, address}], first one
--    is the default on new orders. "Pick up from supplier" is not stored here;
--    it's always offered on the order form.
-- 2. Parts linked to a supplier on the Inventory page now appear in that
--    supplier's catalogue (supplier_materials). Backfill the ones saved before.
-- ============================================================================

alter table public.company_settings
	add column if not exists delivery_addresses jsonb not null default '[]'::jsonb
		check (jsonb_typeof(delivery_addresses) = 'array');

comment on column public.company_settings.delivery_addresses is
	'Where purchase orders can be delivered, in order: [{name, address}]. The first is the default.';

alter table public.company_settings_changes
	drop constraint if exists company_settings_changes_section_check;

alter table public.company_settings_changes
	add constraint company_settings_changes_section_check check (
		section in (
			'company', 'sign_in', 'bank', 'terms', 'numbering', 'tax', 'dollar',
			'trade', 'discount', 'agent', 'sending', 'delivery'
		)
	);

-- Every part's preferred supplier sells it at the part's unit cost until
-- procurement sets their own price. Existing supplier prices are kept.
insert into public.supplier_materials (supplier_id, sku, price)
select p.supplier_id, p.sku, p.unit_cost
from public.parts p
join public.suppliers s on s.id = p.supplier_id
where p.supplier_id is not null
on conflict (supplier_id, sku) do nothing;
