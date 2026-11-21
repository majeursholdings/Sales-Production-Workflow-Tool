-- ============================================================================
-- Seed sample data for Staff, Cost Rates, Pricing & Margins, Clients, Quotes
-- Safe to run once after applying 20261121000002_core_tables.sql.
-- ============================================================================

-- 1. Staff members (only insert if table is currently empty)
insert into public.staff_members (full_name, role, team, hourly_rate, hours_per_month, phone, email, notes)
select *
from (
	values
		('Tobi Adekunle', 'Production lead', 'Production', 3500::numeric, 160::numeric, '+234 803 000 0007', 'production@majeursholdings.com', ''),
		('Babatunde Afolabi', 'Carpenter', 'Production', 2900, 160, '+234 806 214 7730', 'carpenter1@majeursholdings.com', ''),
		('Emeka Nwachukwu', 'Carpenter', 'Production', 2300, 160, '+234 813 552 1904', 'carpenter2@majeursholdings.com', ''),
		('Yusuf Garba', 'Carpenter', 'Production', 2300, 160, '+234 802 778 4410', 'carpenter3@majeursholdings.com', ''),
		('Blessing Okoro', 'Upholsterer', 'Production', 3200, 160, '+234 805 990 2216', 'upholsterer1@majeursholdings.com', ''),
		('Kunle Adeyemi', 'Upholsterer', 'Production', 2800, 160, '+234 816 340 1157', 'upholsterer2@majeursholdings.com', ''),
		('Samuel Etim', 'Finisher', 'Production', 2200, 160, '+234 809 112 6638', 'finisher1@majeursholdings.com', ''),
		('Ibrahim Musa', 'Metal worker', 'Production', 2800, 160, '+234 803 667 2290', 'metal1@majeursholdings.com', ''),
		('Daniel Obi', 'Workshop assistant', 'Production', 1500, 160, '+234 814 220 5501', 'wa1@majeursholdings.com', ''),
		('Peter Udo', 'Workshop assistant', 'Production', 1500, 160, '+234 807 331 9046', 'wa2@majeursholdings.com', ''),
		('Demi Semande', 'Managing Director', 'Non-production', 6000, 160, '+234 803 000 0001', 'demi@majeursholdings.com', ''),
		('Amaka Udeh', 'General Manager', 'Non-production', 4500, 160, '+234 803 000 0002', 'gm@majeursholdings.com', ''),
		('Bisi Lawal', 'Accountant', 'Non-production', 3400, 160, '+234 803 000 0003', 'finance@majeursholdings.com', ''),
		('Ifeanyi Nwosu', 'Procurement lead', 'Non-production', 2800, 160, '+234 803 000 0005', 'poc@majeursholdings.com', ''),
		('Chibuzor Eze', 'Customer care', 'Non-production', 2000, 160, '+234 803 000 1122', 'customerservice@majeursholdings.com', ''),
		('Emeka Obi', 'Sales', 'Non-production', 2000, 160, '+234 803 000 1133', 'sales@majeursholdings.com', ''),
		('Emmanuel Ali', 'Facility officer', 'Non-production', 1500, 160, '+234 811 450 3378', 'facilities@majeursholdings.com', ''),
		('John Bello', 'Driver', 'Non-production', 1400, 160, '+234 810 902 6615', 'musa.driver@majeursholdings.com', '')
) as v(full_name, role, team, hourly_rate, hours_per_month, phone, email, notes)
where not exists (select 1 from public.staff_members);

-- 2. Overhead settings
insert into public.overhead_settings (id, rent_monthly, power_monthly, other_monthly, hours_per_production_person, contingency_percent)
values (1, 1200000, 650000, 250000, 160, 5)
on conflict (id) do update
	set rent_monthly = excluded.rent_monthly,
		power_monthly = excluded.power_monthly,
		other_monthly = excluded.other_monthly,
		hours_per_production_person = excluded.hours_per_production_person,
		contingency_percent = excluded.contingency_percent;

-- 3. Standard cost items
insert into public.cost_items (name, note, cost_type, charged_per, amount, sort_order)
select *
from (
	values
		('Protective wrapping', 'Blankets and stretch film for transport', 'Direct', 'Per piece', 4000::numeric, 1),
		('Delivery within Lagos', 'Truck, driver and two loaders', 'Direct', 'Per trip', 25000, 2),
		('Delivery outside Lagos', 'Ogun, Oyo and Abuja; other states quoted', 'Direct', 'Per trip', 80000, 3),
		('Installation and assembly', 'At the client''s site', 'Direct', 'Per visit', 15000, 4),
		('Site visit and measurement', 'Before production starts', 'Indirect', 'Per project', 10000, 5),
		('Third-party work', 'Glass, stone, metal fabrication or upholstery done outside', 'Direct', 'Per project', 0, 6)
) as v(name, note, cost_type, charged_per, amount, sort_order)
where not exists (select 1 from public.cost_items);

-- 4. Markup categories & pricing rules
insert into public.markup_categories (id, name, furniture_types_count, markup_percent, ceiling_percent, example_cost, sort_order)
values
	('sofas', 'Sofas', 4, 35, 40, 646200, 1),
	('tables', 'Tables', 6, 30, 35, 185000, 2),
	('beds', 'Beds', 3, 32, 38, 540000, 3),
	('chairs', 'Chairs', 5, 28, 35, 160000, 4),
	('storage', 'Storage', 4, 30, 36, 610000, 5),
	('office', 'Office', 3, 25, 30, 334400, 6)
on conflict (id) do nothing;

insert into public.pricing_rules (id, vat_rate, deposit_rate, quote_validity_days, max_general_discount_percent, trade_tiers_label, usd_exchange_rate)
values (1, 0.0750, 0.7000, 7, 10, '5 / 10 / 20%', 1460.00)
on conflict (id) do nothing;

insert into public.pricing_history (summary, actor_label, created_at)
select *
from (
	values
		('Office markup 28% → 25%', 'Bisi Lawal (Accounting)', '2026-11-02T14:05:00+01:00'::timestamptz),
		('Price list imported: 46 part costs updated', 'Ifeanyi Nwosu (Procurement)', '2026-11-02T09:30:00+01:00'::timestamptz),
		('Deposit 50% → 70%', 'Managing Director', '2026-10-15T11:20:00+01:00'::timestamptz),
		('Sofas ceiling 38% → 40%', 'General Manager', '2026-10-01T16:45:00+01:00'::timestamptz)
) as v(summary, actor_label, created_at)
where not exists (select 1 from public.pricing_history);

-- 5. Clients & Quotes
do $$
declare
	c_adaeze uuid;
	c_tunde uuid;
	c_harbour uuid;
	c_moyo uuid;
	c_fatima uuid;
	c_ngozi uuid;
	c_kola uuid;

	q_adaeze uuid;
	q_tunde uuid;
	q_fatima uuid;
	q_harbour uuid;
	q_ngozi uuid;
	q_kola uuid;

	v_tunde_1 uuid;
	v_tunde_2 uuid;
	v_other uuid;
begin
	if not exists (select 1 from public.clients) then
		insert into public.clients (name, phone, phone_key, email, client_type, company, location, source, quotes_count, total_spent, last_activity_label, trade_tier, last_activity_at)
		values ('Adaeze Okafor', '+234 803 555 0142', '+2348035550142', 'adaeze.okafor@gmail.com', 'Trade', 'Okafor Interiors Studio', 'Lekki Phase 1, Lagos', 'Referral', 4, 1842000, 'Quote drafted today', 'Starter · no discount yet', '2026-11-07T14:32:00+01:00')
		returning id into c_adaeze;

		insert into public.clients (name, phone, phone_key, email, client_type, company, location, source, quotes_count, total_spent, last_activity_label, trade_tier, last_activity_at)
		values ('Tunde Bakare', '+234 802 314 7760', '+2348023147760', 'tunde.bakare@outlook.com', 'Individual', '', 'GRA Ikeja, Lagos', 'Instagram', 1, 1451250, 'Deposit recorded 7 Nov', '', '2026-11-07T10:15:00+01:00')
		returning id into c_tunde;

		insert into public.clients (name, phone, phone_key, email, client_type, company, location, source, quotes_count, total_spent, last_activity_label, trade_tier, last_activity_at)
		values ('Harbourview Suites', '+234 1 271 0040', null, '', 'Trade', 'Harbourview Hotels Ltd', 'Victoria Island, Lagos', 'Local outreach', 2, 8940000, 'In production', 'Starter · no discount yet', '2026-11-06T16:20:00+01:00')
		returning id into c_harbour;

		insert into public.clients (name, phone, phone_key, email, client_type, company, location, source, quotes_count, total_spent, last_activity_label, trade_tier, last_activity_at)
		values ('Moyo & Okeke Interiors', '+234 809 118 2290', '+2348091182290', '', 'Trade', 'Moyo & Okeke Interiors', 'Ikoyi, Lagos', 'Website', 9, 21460500, 'Order ready 12 Nov', 'Silver · 5% off', '2026-11-05T15:00:00+01:00')
		returning id into c_moyo;

		insert into public.clients (name, phone, phone_key, email, client_type, company, location, source, quotes_count, total_spent, last_activity_label, trade_tier, last_activity_at)
		values ('Fatima Bello', '+234 805 330 7781', '+2348053307781', '', 'Individual', '', 'Asokoro, Abuja', 'Family & friends', 1, 0, 'Quote sent 5 Nov', '', '2026-11-05T13:00:00+01:00')
		returning id into c_fatima;

		insert into public.clients (name, phone, phone_key, email, client_type, company, location, source, quotes_count, total_spent, last_activity_label, trade_tier, last_activity_at)
		values ('Ngozi Adeyemi', '+234 809 123 4455', '+2348091234455', 'ngozi.adeyemi@yahoo.com', 'Individual', '', 'Magodo, Lagos', 'TikTok', 1, 0, 'Quote expires 8 Nov', '', '2026-11-01T09:30:00+01:00')
		returning id into c_ngozi;

		insert into public.clients (name, phone, phone_key, email, client_type, company, location, source, quotes_count, total_spent, last_activity_label, trade_tier, last_activity_at)
		values ('Kola Martins', '+234 813 004 5521', '+2348130045521', '', 'Trade', 'Martins & Co.', 'Yaba, Lagos', 'Showroom walk-in', 1, 0, 'Quote expired 4 Nov', 'Starter · no discount yet', '2026-10-28T11:45:00+01:00')
		returning id into c_kola;
	else
		select id into c_adaeze from public.clients where name = 'Adaeze Okafor' limit 1;
		select id into c_tunde from public.clients where name = 'Tunde Bakare' limit 1;
		select id into c_harbour from public.clients where name = 'Harbourview Suites' limit 1;
		select id into c_fatima from public.clients where name = 'Fatima Bello' limit 1;
		select id into c_ngozi from public.clients where name = 'Ngozi Adeyemi' limit 1;
		select id into c_kola from public.clients where name = 'Kola Martins' limit 1;
	end if;

	if not exists (select 1 from public.quotes) then
		-- Adaeze Okafor (draft)
		insert into public.quotes (quote_number, client_id, client_name, items_summary, status, total_ngn, current_version, valid_until, created_by_name, created_at)
		values ('MAJ-QT-20261107-1432', c_adaeze, 'Adaeze Okafor', '3-seater sofa, coffee table', 'draft', 1644170.50, 1, '2026-11-14', 'Chiamaka Eze', '2026-11-07T14:32:00+01:00')
		returning id into q_adaeze;

		insert into public.quote_versions (quote_id, version_number, sent_line)
		values (q_adaeze, 1, 'By Chiamaka Eze')
		returning id into v_other;

		insert into public.quote_lines (quote_version_id, name, description, quantity, unit_price, sort_order)
		values (v_other, '3-seater sofa, coffee table', 'Draft items from quote builder', 1, 1529460.93, 1);

		insert into public.quote_activity (quote_id, when_label, what, detail, created_at)
		values (q_adaeze, '7 Nov 2026, 14:32', 'Quote created (v1)', 'by Chiamaka Eze', '2026-11-07T14:32:00+01:00');

		-- Tunde Bakare (sent, v2 with v1 history)
		insert into public.quotes (quote_number, client_id, client_name, items_summary, status, total_ngn, current_version, valid_until, sent_at, created_by_name, created_at)
		values ('MAJ-QT-20261106-1015', c_tunde, 'Tunde Bakare', 'Dining table, 6 chairs', 'sent', 2418750.00, 2, '2026-11-13', '2026-11-06T10:42:00+01:00', 'Emeka Obi', '2026-11-06T10:15:00+01:00')
		returning id into q_tunde;

		insert into public.quote_versions (quote_id, version_number, sent_line, created_at)
		values (q_tunde, 1, 'Sent 5 Nov, 16:20 by Emeka Obi', '2026-11-05T16:20:00+01:00')
		returning id into v_tunde_1;

		insert into public.quote_lines (quote_version_id, name, description, quantity, unit_price, sort_order)
		values
			(v_tunde_1, 'Dining table', 'Solid walnut, 220 × 100 cm, seats 8', 1, 1026000, 1),
			(v_tunde_1, 'Dining chair', 'Walnut frame, woven paper cord seat (black)', 6, 204000, 2),
			(v_tunde_1, 'Carver armchair', 'Walnut frame with arms, woven cord seat', 2, 310000, 3);

		insert into public.quote_versions (quote_id, version_number, sent_line, change_note, changes, created_at)
		values (
			q_tunde,
			2,
			'Sent 6 Nov, 10:42 by Emeka Obi',
			'Requested by the client on WhatsApp, 6 Nov · noted by Emeka Obi.',
			'[
				{"tag":"Removed","tone":"danger","text":"Carver armchair × 2","amount":"− ₦620,000.00"},
				{"tag":"Changed","tone":"info","text":"Dining chair: woven cord colour black → natural","amount":"₦0.00"},
				{"tag":"Total","tone":"neutral","text":"₦3,085,250.00 → ₦2,418,750.00","amount":"− ₦666,500.00"}
			]'::jsonb,
			'2026-11-06T10:42:00+01:00'
		)
		returning id into v_tunde_2;

		insert into public.quote_lines (quote_version_id, name, description, quantity, unit_price, sort_order)
		values
			(v_tunde_2, 'Dining table', 'Solid walnut, 220 × 100 cm, seats 8', 1, 1026000, 1),
			(v_tunde_2, 'Dining chair', 'Walnut frame, woven paper cord seat (natural)', 6, 204000, 2);

		insert into public.quote_activity (quote_id, when_label, what, detail, created_at)
		values
			(q_tunde, '5 Nov 2026, 16:05', 'Quote created (v1)', 'by Emeka Obi (Sales)', '2026-11-05T16:05:00+01:00'),
			(q_tunde, '5 Nov 2026, 16:20', 'v1 sent', 'to tunde.bakare@outlook.com', '2026-11-05T16:20:00+01:00'),
			(q_tunde, '6 Nov 2026, 10:30', 'v2 created', 'by Emeka Obi: removed carver armchairs, cord colour changed', '2026-11-06T10:30:00+01:00'),
			(q_tunde, '6 Nov 2026, 10:42', 'v2 sent', 'v1 marked superseded', '2026-11-06T10:42:00+01:00');

		-- Fatima Bello (sent)
		insert into public.quotes (quote_number, client_id, client_name, items_summary, status, total_ngn, current_version, valid_until, sent_at, created_by_name, created_at)
		values ('MAJ-QT-20261105-1300', c_fatima, 'Fatima Bello', '3-door wardrobe', 'sent', 964250.00, 1, '2026-11-12', '2026-11-05T13:00:00+01:00', 'Chiamaka Eze', '2026-11-05T13:00:00+01:00')
		returning id into q_fatima;

		insert into public.quote_versions (quote_id, version_number, sent_line)
		values (q_fatima, 1, 'Sent 5 Nov, 13:00 by Chiamaka Eze')
		returning id into v_other;

		insert into public.quote_lines (quote_version_id, name, description, quantity, unit_price, sort_order)
		values (v_other, '3-door wardrobe', 'Custom oak veneer, soft-close hinges', 1, 896976.74, 1);

		insert into public.quote_activity (quote_id, when_label, what, detail, created_at)
		values (q_fatima, '5 Nov 2026, 13:00', 'Quote sent (v1)', 'by Chiamaka Eze', '2026-11-05T13:00:00+01:00');

		-- Harbourview Suites (paid)
		insert into public.quotes (quote_number, client_id, client_name, items_summary, status, total_ngn, current_version, valid_until, sent_at, created_by_name, created_at)
		values ('MAJ-QT-20261104-1620', c_harbour, 'Harbourview Suites', 'Lobby lounge chairs × 12', 'paid', 8940000.00, 1, '2026-11-11', '2026-11-04T16:20:00+01:00', 'Emeka Obi', '2026-11-04T16:20:00+01:00')
		returning id into q_harbour;

		insert into public.quote_versions (quote_id, version_number, sent_line)
		values (q_harbour, 1, 'Sent 4 Nov, 16:20 by Emeka Obi')
		returning id into v_other;

		insert into public.quote_lines (quote_version_id, name, description, quantity, unit_price, sort_order)
		values (v_other, 'Lobby lounge chair', 'Solid walnut frame, commercial boucle upholstery', 12, 693023.26, 1);

		insert into public.quote_activity (quote_id, when_label, what, detail, created_at)
		values
			(q_harbour, '4 Nov 2026, 16:20', 'Quote sent (v1)', 'by Emeka Obi', '2026-11-04T16:20:00+01:00'),
			(q_harbour, '5 Nov 2026, 11:20', 'Deposit recorded on v1', 'by Bisi Lawal (Accounting)', '2026-11-05T11:20:00+01:00');

		-- Ngozi Adeyemi (expiring)
		insert into public.quotes (quote_number, client_id, client_name, items_summary, status, total_ngn, current_version, valid_until, sent_at, created_by_name, created_at)
		values ('MAJ-QT-20261101-0930', c_ngozi, 'Ngozi Adeyemi', 'King bed frame, 2 nightstands', 'expiring', 1085600.00, 1, '2026-11-08', '2026-11-01T09:30:00+01:00', 'Chiamaka Eze', '2026-11-01T09:30:00+01:00')
		returning id into q_ngozi;

		insert into public.quote_versions (quote_id, version_number, sent_line)
		values (q_ngozi, 1, 'Sent 1 Nov, 09:30 by Chiamaka Eze')
		returning id into v_other;

		insert into public.quote_lines (quote_version_id, name, description, quantity, unit_price, sort_order)
		values
			(v_other, 'King bed frame', 'Upholstered headboard, walnut base', 1, 749860.47, 1),
			(v_other, 'Nightstand', 'Matching walnut bedside table, 2 drawers', 2, 130000, 2);

		insert into public.quote_activity (quote_id, when_label, what, detail, created_at)
		values (q_ngozi, '1 Nov 2026, 09:30', 'Quote sent (v1)', 'by Chiamaka Eze', '2026-11-01T09:30:00+01:00');

		-- Kola Martins (expired)
		insert into public.quotes (quote_number, client_id, client_name, items_summary, status, total_ngn, current_version, valid_until, sent_at, created_by_name, created_at)
		values ('MAJ-QT-20261028-1145', c_kola, 'Kola Martins', 'Office desks × 4', 'expired', 1672000.00, 1, '2026-11-04', '2026-10-28T11:45:00+01:00', 'Emeka Obi', '2026-10-28T11:45:00+01:00')
		returning id into q_kola;

		insert into public.quote_versions (quote_id, version_number, sent_line)
		values (q_kola, 1, 'Sent 28 Oct, 11:45 by Emeka Obi')
		returning id into v_other;

		insert into public.quote_lines (quote_version_id, name, description, quantity, unit_price, sort_order)
		values (v_other, 'Executive office desk', '180 × 80 cm walnut veneer top, powder-coated steel frame', 4, 388837.21, 1);

		insert into public.quote_activity (quote_id, when_label, what, detail, created_at)
		values (q_kola, '28 Oct 2026, 11:45', 'Quote sent (v1)', 'by Emeka Obi', '2026-10-28T11:45:00+01:00');
	end if;
end $$;
