-- ============================================================================
-- Every name a form collects is title + first name + surname.
--
--   * title (Mr, Mrs, Ms, Dr, Chief…) on team members, clients and staff, and
--     contact_title on suppliers. Optional, and kept out of the written-out
--     name so initials, search and sign-in claims don't change.
--   * staff_members and suppliers' contacts get first name + surname, kept in
--     step with their written-out column the same way as profiles and clients
--     (20261127000005): parts changed → name rebuilt; only the name changed →
--     split on the last word.
-- ============================================================================

alter table public.profiles add column if not exists title text not null default '';
alter table public.clients add column if not exists title text not null default '';

-- ----------------------------------------------------------------------------
-- Generic sync: trigger args are (written-out column, first name column, surname column).
-- ----------------------------------------------------------------------------
create or replace function private.sync_name_parts()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
	v_full_col text := tg_argv[0];
	v_first_col text := tg_argv[1];
	v_surname_col text := tg_argv[2];
	v_new jsonb := to_jsonb(new);
	v_old jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) end;
	v_first text := btrim(coalesce(v_new ->> v_first_col, ''));
	v_surname text := btrim(coalesce(v_new ->> v_surname_col, ''));
	v_split record;
begin
	if (tg_op = 'INSERT' and (v_first <> '' or v_surname <> ''))
		or (tg_op = 'UPDATE' and (
			(v_new ->> v_first_col) is distinct from (v_old ->> v_first_col)
			or (v_new ->> v_surname_col) is distinct from (v_old ->> v_surname_col)
		))
	then
		new := jsonb_populate_record(new, jsonb_build_object(
			v_first_col, v_first,
			v_surname_col, v_surname,
			v_full_col, coalesce(nullif(private.join_name(v_first, v_surname), ''), v_new ->> v_full_col)
		));
	elsif tg_op = 'INSERT' or (v_new ->> v_full_col) is distinct from (v_old ->> v_full_col) then
		v_split := private.split_full_name(v_new ->> v_full_col);
		new := jsonb_populate_record(new, jsonb_build_object(
			v_first_col, v_split.first_name,
			v_surname_col, v_split.surname
		));
	end if;
	return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- staff_members
-- ----------------------------------------------------------------------------
alter table public.staff_members
	add column if not exists title text not null default '',
	add column if not exists first_name text not null default '',
	add column if not exists surname text not null default '';

drop trigger if exists staff_members_sync_name on public.staff_members;
create trigger staff_members_sync_name
	before insert or update on public.staff_members
	for each row execute function private.sync_name_parts('full_name', 'first_name', 'surname');

update public.staff_members m
set first_name = s.first_name, surname = s.surname
from public.staff_members m2
cross join lateral private.split_full_name(m2.full_name) s
where m.id = m2.id and m.first_name = '' and m.surname = '';

-- ----------------------------------------------------------------------------
-- suppliers (the person we deal with)
-- ----------------------------------------------------------------------------
alter table public.suppliers
	add column if not exists contact_title text not null default '',
	add column if not exists contact_first_name text not null default '',
	add column if not exists contact_surname text not null default '';

drop trigger if exists suppliers_sync_contact_name on public.suppliers;
create trigger suppliers_sync_contact_name
	before insert or update on public.suppliers
	for each row execute function private.sync_name_parts('contact', 'contact_first_name', 'contact_surname');

update public.suppliers x
set contact_first_name = s.first_name, contact_surname = s.surname
from public.suppliers x2
cross join lateral private.split_full_name(x2.contact) s
where x.id = x2.id and x.contact_first_name = '' and x.contact_surname = '';
