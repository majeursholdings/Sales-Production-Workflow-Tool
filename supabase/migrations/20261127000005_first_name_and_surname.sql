-- ============================================================================
-- First name and surname for people: team members (profiles) and clients.
--
-- profiles.full_name and clients.name stay as the written-out name ("Adaeze
-- Okafor"): session claims, invites, documents and search all read them. A
-- trigger keeps them in step with the parts, whichever side is written:
--   * first_name / surname changed → full name rebuilt from them
--   * only the full name changed (e.g. a new auth user's metadata) → split:
--     the last word is the surname, the rest the first name
-- ============================================================================

-- "Mary Jane Okafor" → ("Mary Jane", "Okafor"); "Okafor" → ("Okafor", "").
create or replace function private.split_full_name(p_full text, out first_name text, out surname text)
language plpgsql
immutable
set search_path = ''
as $$
declare
	v_full text := btrim(regexp_replace(coalesce(p_full, ''), '\s+', ' ', 'g'));
begin
	if position(' ' in v_full) = 0 then
		first_name := v_full;
		surname := '';
	else
		surname := substring(v_full from '([^ ]+)$');
		first_name := btrim(left(v_full, length(v_full) - length(surname)));
	end if;
end;
$$;

create or replace function private.join_name(p_first text, p_surname text)
returns text
language sql
immutable
set search_path = ''
as $$
	select btrim(concat_ws(' ', nullif(btrim(p_first), ''), nullif(btrim(p_surname), '')));
$$;

-- ----------------------------------------------------------------------------
-- profiles
-- ----------------------------------------------------------------------------
alter table public.profiles
	add column if not exists first_name text not null default '',
	add column if not exists surname text not null default '';

create or replace function private.profiles_sync_name()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
	v_split record;
begin
	if (tg_op = 'INSERT' and (btrim(new.first_name) <> '' or btrim(new.surname) <> ''))
		or (tg_op = 'UPDATE' and (new.first_name, new.surname) is distinct from (old.first_name, old.surname))
	then
		new.first_name := btrim(new.first_name);
		new.surname := btrim(new.surname);
		new.full_name := coalesce(nullif(private.join_name(new.first_name, new.surname), ''), new.full_name);
	elsif tg_op = 'INSERT' or new.full_name is distinct from old.full_name then
		v_split := private.split_full_name(new.full_name);
		new.first_name := v_split.first_name;
		new.surname := v_split.surname;
	end if;
	return new;
end;
$$;

drop trigger if exists profiles_sync_name on public.profiles;
create trigger profiles_sync_name
	before insert or update on public.profiles
	for each row execute function private.profiles_sync_name();

update public.profiles p
set first_name = s.first_name, surname = s.surname
from public.profiles p2
cross join lateral private.split_full_name(p2.full_name) s
where p.id = p2.id and p.first_name = '' and p.surname = '';

-- ----------------------------------------------------------------------------
-- clients
-- ----------------------------------------------------------------------------
alter table public.clients
	add column if not exists first_name text not null default '',
	add column if not exists surname text not null default '';

create or replace function private.clients_sync_name()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
	v_split record;
begin
	if (tg_op = 'INSERT' and (btrim(new.first_name) <> '' or btrim(new.surname) <> ''))
		or (tg_op = 'UPDATE' and (new.first_name, new.surname) is distinct from (old.first_name, old.surname))
	then
		new.first_name := btrim(new.first_name);
		new.surname := btrim(new.surname);
		new.name := coalesce(nullif(private.join_name(new.first_name, new.surname), ''), new.name);
	elsif tg_op = 'INSERT' or new.name is distinct from old.name then
		v_split := private.split_full_name(new.name);
		new.first_name := v_split.first_name;
		new.surname := v_split.surname;
	end if;
	return new;
end;
$$;

drop trigger if exists clients_sync_name on public.clients;
create trigger clients_sync_name
	before insert or update on public.clients
	for each row execute function private.clients_sync_name();

update public.clients c
set first_name = s.first_name, surname = s.surname
from public.clients c2
cross join lateral private.split_full_name(c2.name) s
where c.id = c2.id and c.first_name = '' and c.surname = '';
