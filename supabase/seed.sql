-- ============================================================================
-- LOCAL / OFFLINE TESTING SEED — runs only on `supabase db reset` locally.
-- Creates one confirmed test user per app role. Password for all: password123
-- ============================================================================

do $$
declare
	r record;
	v_id uuid;
begin
	for r in
		select * from (values
			('md@test.local', 'Test MD', 'md'),
			('gm@test.local', 'Test GM', 'gm'),
			('accounting@test.local', 'Test Accounting', 'accounting'),
			('procurement@test.local', 'Test Procurement', 'procurement'),
			('production@test.local', 'Test Production', 'production'),
			('sales@test.local', 'Test Sales', 'sales'),
			('customer_care@test.local', 'Test Customer Care', 'customer_care')
		) as t(email, full_name, role)
	loop
		v_id := gen_random_uuid();

		insert into auth.users (
			instance_id, id, aud, role, email, encrypted_password,
			email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
			created_at, updated_at,
			confirmation_token, recovery_token, email_change, email_change_token_new
		) values (
			'00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
			r.email, extensions.crypt('password123', extensions.gen_salt('bf')),
			now(),
			jsonb_build_object('provider', 'email', 'providers', array['email'], 'role', r.role),
			jsonb_build_object('full_name', r.full_name),
			now(), now(),
			'', '', '', ''
		);

		insert into auth.identities (
			id, user_id, provider_id, provider, identity_data,
			last_sign_in_at, created_at, updated_at
		) values (
			gen_random_uuid(), v_id, v_id::text, 'email',
			jsonb_build_object('sub', v_id::text, 'email', r.email, 'email_verified', true),
			now(), now(), now()
		);
	end loop;
end $$;
