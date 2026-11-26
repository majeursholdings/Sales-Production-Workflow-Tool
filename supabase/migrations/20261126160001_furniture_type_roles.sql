-- ============================================================================
-- Furniture type access by role
--   MD / GM     : add, edit, delete (with costs)
--   Procurement : add, edit (with costs), no delete
--   Production  : add, edit, delete (no costs; other costs stay as saved)
-- ============================================================================

-- 1. Role permissions
insert into public.role_permissions (role, permission)
values
	('md', 'templates.delete'),
	('gm', 'templates.delete'),
	('production', 'templates.delete'),
	('procurement', 'templates.edit')
on conflict (role, permission) do nothing;

-- 2. Only templates.delete may delete a furniture type. Child rows (parts,
--    hours, extras) keep templates.edit: saving a template replaces them.
drop policy if exists "Template editors can delete furniture types" on public.furniture_types;

create policy "Template deleters can delete furniture types"
	on public.furniture_types for delete to authenticated
	using ((select private.authorize('templates.delete')));

-- 3. Furniture photos: every template editor can upload and remove them
--    (production no longer needs quotes.view_prices).
create or replace function private.can_write_project_media(p_name text)
returns boolean
language sql
stable
set search_path = ''
as $$
	select case (storage.foldername(p_name))[1]
		when 'furniture' then
			(select private.authorize('templates.edit'))
		when 'parts' then
			(select private.authorize('materials.edit'))
		when 'machines' then
			(select private.authorize('work_orders.edit_status'))
			or (select private.authorize('materials.edit'))
		when 'job-cards' then
			(select private.authorize('work_orders.edit_status'))
		when 'cost-requests' then
			(select private.authorize('quotes.create'))
			or (select private.authorize('materials.edit'))
		else false
	end;
$$;

revoke all on function private.can_write_project_media(text) from public, anon;
grant execute on function private.can_write_project_media(text) to authenticated;
