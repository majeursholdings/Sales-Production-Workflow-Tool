-- ============================================================================
-- Private project media storage bucket, folder-scoped RLS policies, and
-- photo URL columns for machines, maintenance records, job card redos &
-- deliveries.
--
-- Bucket layout (`project-media`, private — served through authenticated
-- `/api/storage/<folder>/<file>` after verifying the live session + RLS):
--   furniture/<file>     — furniture type photos (cover first)
--   parts/<file>         — inventory / material part photos
--   machines/<file>      — machine & maintenance photos
--   job-cards/<file>     — workshop redo & delivery photos
--   cost-requests/<file> — custom-design reference photos
--
-- Public document logos continue to live in `company-assets`.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Private storage bucket
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
	'project-media',
	'project-media',
	false,
	10485760,
	array[
		'image/jpeg',
		'image/png',
		'image/webp',
		'image/gif',
		'image/avif',
		'image/heic',
		'image/heif'
	]
)
on conflict (id) do update set
	public = excluded.public,
	file_size_limit = excluded.file_size_limit,
	allowed_mime_types = excluded.allowed_mime_types;

-- ----------------------------------------------------------------------------
-- 2. Folder-scoped RLS helpers (private schema, never exposed via Data API)
-- ----------------------------------------------------------------------------
create or replace function private.can_read_project_media(p_name text)
returns boolean
language sql
stable
set search_path = ''
as $$
	select case (storage.foldername(p_name))[1]
		when 'furniture' then
			(select private.current_user_role()) is not null
		when 'parts' then
			(select private.authorize('materials.view'))
			or (select private.authorize('templates.view'))
			or (select private.authorize('work_orders.view'))
			or (select private.authorize('purchase_orders.view'))
		when 'machines' then
			(select private.authorize('work_orders.view'))
			or (select private.authorize('materials.view'))
		when 'job-cards' then
			(select private.authorize('work_orders.view'))
		when 'cost-requests' then
			(select private.authorize('materials.view'))
			or (select private.authorize('quotes.create'))
			or (select private.authorize('quotes.view'))
		else false
	end;
$$;

revoke all on function private.can_read_project_media(text) from public, anon;
grant execute on function private.can_read_project_media(text) to authenticated;

create or replace function private.can_write_project_media(p_name text)
returns boolean
language sql
stable
set search_path = ''
as $$
	select case (storage.foldername(p_name))[1]
		when 'furniture' then
			(select private.authorize('templates.edit'))
			and (select private.authorize('quotes.view_prices'))
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

-- ----------------------------------------------------------------------------
-- 3. Storage RLS policies on storage.objects (`project-media`)
-- ----------------------------------------------------------------------------
create policy "Authorized staff can read project media"
	on storage.objects for select to authenticated
	using (
		bucket_id = 'project-media'
		and private.can_read_project_media(name)
	);

create policy "Authorized staff can upload project media"
	on storage.objects for insert to authenticated
	with check (
		bucket_id = 'project-media'
		and private.can_write_project_media(name)
	);

create policy "Authorized staff can update project media"
	on storage.objects for update to authenticated
	using (
		bucket_id = 'project-media'
		and private.can_write_project_media(name)
	)
	with check (
		bucket_id = 'project-media'
		and private.can_write_project_media(name)
	);

create policy "Authorized staff can delete project media"
	on storage.objects for delete to authenticated
	using (
		bucket_id = 'project-media'
		and private.can_write_project_media(name)
	);

-- ----------------------------------------------------------------------------
-- 4. Missing photo columns for machines, maintenance, redos & deliveries
-- ----------------------------------------------------------------------------
alter table public.machines
	add column if not exists photo_url text not null default '';

alter table public.machine_maintenance
	add column if not exists photo_urls text[] not null default '{}';

alter table public.job_card_redos
	add column if not exists photo_urls text[] not null default '{}';

alter table public.job_cards
	add column if not exists delivery_photo_urls text[] not null default '{}';

-- Also allow cost-request reviewers (procurement, MD, GM) to attach extra
-- reference photos to open cost requests.
create policy "Reviewers can add images to open cost requests"
	on public.cost_request_images for insert to authenticated
	with check (
		(select private.authorize('materials.edit'))
		and exists (
			select 1 from public.cost_requests r
			where r.id = request_id and r.status = 'open'
		)
	);
