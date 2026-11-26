-- ============================================================================
-- 1. Extend public.session_state() to also return profile & role fields
--    so server components can verify the live session and load the user's
--    profile + role in a single RPC instead of getUser() + RPC + 2 queries.
--
--    All existing keys are preserved unchanged for backwards compatibility.
--
-- 2. Add composite index on quotes(created_by, created_at desc) for role-scoped
--    sales/customer-care dashboard queries.
-- ============================================================================

create or replace function public.session_state(p_device_token text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_uid uuid := auth.uid();
	v_sid uuid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
	v_active boolean;
	v_two_step_email boolean;
	v_full_name text;
	v_email text;
	v_phone text;
	v_role public.app_role;
begin
	if v_uid is null or v_sid is null then
		return jsonb_build_object('live', false);
	end if;

	select p.is_active, p.two_step_email, p.full_name, p.email, p.phone, r.role
	into v_active, v_two_step_email, v_full_name, v_email, v_phone, v_role
	from public.profiles p
	left join public.user_roles r on r.user_id = p.id
	where p.id = v_uid;

	return jsonb_build_object(
		-- The session still exists (not signed out, revoked or deleted) and isn't past not_after.
		'live', exists (
			select 1 from auth.sessions s
			where s.id = v_sid
				and s.user_id = v_uid
				and (s.not_after is null or s.not_after > now())
		),
		'active', coalesce(v_active, false),
		'hasApp', exists (
			select 1 from auth.mfa_factors f
			where f.user_id = v_uid and f.factor_type = 'totp' and f.status = 'verified'
		),
		'twoStepEmail', coalesce(v_two_step_email, false),
		'emailPassed', exists (
			select 1 from public.email_mfa_passes m where m.session_id = v_sid
		),
		-- Locked after 5 wrong passwords (its sessions were deleted then; this names why).
		'accountLocked', exists (
			select 1 from public.login_attempts a
			join auth.users u on lower(u.email) = a.email
			where u.id = v_uid and a.account_locked_at is not null
		),
		-- Signed in from an invite and hasn't set a password yet. (Supabase gives
		-- password-less accounts a random one, so the invite row is the signal.)
		'needsPassword', exists (select 1 from public.pending_invites i where i.user_id = v_uid),
		-- Unlocked, and the person hasn't said whether the lockout was them.
		'lockoutReview', exists (select 1 from public.lockout_reviews r where r.user_id = v_uid),
		'trustedDevice', p_device_token is not null and exists (
			select 1 from public.trusted_devices d
			where d.user_id = v_uid
				and d.token_hash = encode(extensions.digest(p_device_token, 'sha256'), 'hex')
				and d.expires_at > now()
		),
		-- Profile & role fields so Server Components don't repeat profiles/user_roles lookups.
		'fullName', v_full_name,
		'email', v_email,
		'phone', v_phone,
		'role', v_role
	);
end;
$$;

revoke execute on function public.session_state(text) from public, anon;
grant execute on function public.session_state(text) to authenticated;

create index if not exists quotes_created_by_created_at_idx
	on public.quotes (created_by, created_at desc);
