-- ============================================================================
-- Bootstrap your first Managing Director (superadmin) account
-- ============================================================================
-- 1. Create the user in Supabase Dashboard -> Authentication -> Users -> Add user
--    (e.g. md@majeursholdings.com, check "Auto Confirm User").
-- 2. Replace the email below and run this snippet in the Supabase SQL Editor.
-- 3. Sign in to the app — you can then create and manage everyone else in
--    "Team & access" (/team).

do $$
declare
	v_email text := 'ecommerce@majeursholdings.com';
	v_name text := 'Managing Director';
	v_uid uuid;
begin
	select id into v_uid from auth.users where lower(email) = lower(v_email);

	if v_uid is null then
		raise exception 'No auth.users account found for %. Create it in Authentication -> Users first.', v_email;
	end if;

	insert into public.profiles (id, full_name, email, is_active)
	values (v_uid, v_name, v_email, true)
	on conflict (id) do update
		set full_name = excluded.full_name,
			is_active = true;

	insert into public.user_roles (user_id, role)
	values (v_uid, 'md')
	on conflict (user_id) do update
		set role = 'md';

	update auth.users
	set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'md')
	where id = v_uid;
end $$;
