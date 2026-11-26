-- Session lifetimes, live session checks, trusted devices and sign-in lockout.
--
-- 1. Session lifetime. When someone signs in, the server sets the session's
--    `not_after` in auth.sessions: 30 days with "Keep me signed in", 12 hours
--    without. Supabase Auth refuses to refresh a session past `not_after`
--    (error `session_expired`), so this holds even for calls that skip the app.
--    The access token hook copies it into a `session_expires_at` claim so the
--    proxy can also refuse an access token issued before the cut-off.
--
-- 2. Lockout, per email (never per IP, so people sharing an office network
--    aren't affected by each other):
--    - 3 wrong passwords: sign-in for that email pauses for 5 minutes.
--    - 2 more wrong passwords: the account is locked and every one of its
--      sessions is signed out, until the MD or GM unlocks it in Team & access.
--      Unlocking emails the person a sign-in link; once in, they're asked
--      whether the lockout was them, and if not, to set a stronger password.
--    Counted whether or not an account exists, so locks don't reveal which
--    emails have accounts. Only the server (service role) writes these tables.
--
-- 3. Live sessions. session_state() is called by the proxy on every request:
--    a session that was signed out, revoked, expired, or whose account was
--    deactivated or deleted stops working on the next request, not when its
--    access token runs out.
--
-- 4. Trusted devices. "Don't ask again on this computer for 30 days" stores a
--    hash of a random token kept in an HttpOnly cookie on that browser.
--
-- 5. Invites. The MD or GM adds a person with name, email and role only. They
--    get a link (valid 48 hours, only its hash is stored) that signs them in
--    to set their own password; email codes are their two-step by default.
--    Until they set a password (their invite is still pending), session_state
--    reports needsPassword and the proxy keeps them on /welcome.
--
-- 6. Email. The app sends every email itself (nodemailer); Supabase only
--    generates the codes and links. claim_email_send() allows one email of
--    each kind per address per short window, so no inbox can be flooded.

-- ----------------------------------------------------------------------------
-- Failed sign-in attempts, per email
-- ----------------------------------------------------------------------------
create table public.login_attempts (
	email text primary key,
	-- Wrong passwords in the current streak (resets after a correct password,
	-- an unlock, or 24 hours without a wrong one).
	failed_count integer not null default 0,
	-- The 5-minute pause after the 3rd wrong password.
	locked_until timestamptz,
	-- Set on the 5th wrong password; cleared only by an MD or GM unlock.
	account_locked_at timestamptz,
	updated_at timestamptz not null default now()
);

comment on table public.login_attempts is
	'Wrong-password streaks per email: 5-minute pause at 3, account lock at 5. Service role only.';

alter table public.login_attempts enable row level security;
revoke all on public.login_attempts from anon, authenticated;

-- ----------------------------------------------------------------------------
-- Unlocked accounts waiting for the person to answer "was the lockout you?"
-- ----------------------------------------------------------------------------
create table public.lockout_reviews (
	user_id uuid primary key references auth.users (id) on delete cascade,
	-- When the MD or GM unlocked the account.
	unlocked_at timestamptz not null default now()
);

comment on table public.lockout_reviews is
	'Accounts unlocked after a lockout whose owner hasn''t yet said whether it was them. Written only by the service role.';

alter table public.lockout_reviews enable row level security;
revoke all on public.lockout_reviews from anon, authenticated;

-- ----------------------------------------------------------------------------
-- Invites waiting to be accepted (one per person; a resend replaces it)
-- ----------------------------------------------------------------------------
create table public.pending_invites (
	user_id uuid primary key references auth.users (id) on delete cascade,
	-- sha256 (hex) of the random token in the emailed link.
	token_hash text not null unique,
	expires_at timestamptz not null,
	created_at timestamptz not null default now()
);

comment on table public.pending_invites is
	'Invite links not yet used to set a password (emailed by the app). Written only by the service role.';

alter table public.pending_invites enable row level security;
revoke all on public.pending_invites from anon, authenticated;

-- ----------------------------------------------------------------------------
-- Email send throttle: last send per address and kind
-- ----------------------------------------------------------------------------
create table public.email_sends (
	email text not null,
	-- code | invite | unlock | reset
	purpose text not null,
	sent_at timestamptz not null default now(),
	primary key (email, purpose)
);

comment on table public.email_sends is
	'When the app last emailed each address, per kind of email. Service role only.';

alter table public.email_sends enable row level security;
revoke all on public.email_sends from anon, authenticated;

-- True (and records the send) when this address hasn't had this kind of email
-- in the last p_seconds; false when it's too soon.
create or replace function public.claim_email_send(
	p_email text,
	p_purpose text,
	p_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
	insert into public.email_sends as e (email, purpose, sent_at)
	values (lower(trim(p_email)), p_purpose, now())
	on conflict (email, purpose) do update set sent_at = now()
	where e.sent_at < now() - make_interval(secs => p_seconds);
	return found;
end;
$$;

revoke execute on function public.claim_email_send(text, text, integer) from public, anon, authenticated;
grant execute on function public.claim_email_send(text, text, integer) to service_role;

-- ----------------------------------------------------------------------------
-- Trusted devices: browsers that skip the second step for 30 days
-- ----------------------------------------------------------------------------
create table public.trusted_devices (
	-- sha256 (hex) of the random token in the browser's HttpOnly cookie.
	token_hash text primary key,
	user_id uuid not null references auth.users (id) on delete cascade,
	created_at timestamptz not null default now(),
	expires_at timestamptz not null
);

comment on table public.trusted_devices is
	'Browsers trusted to skip two-step verification. Written only by the service role.';

create index trusted_devices_user_id_idx on public.trusted_devices (user_id);

alter table public.trusted_devices enable row level security;
revoke all on public.trusted_devices from anon, authenticated;

-- ----------------------------------------------------------------------------
-- record_login_failure: count a wrong password for an email
-- Returns {"count": int, "lockedUntil": timestamptz | null, "accountLocked": bool}
-- ----------------------------------------------------------------------------
create or replace function public.record_login_failure(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	c_pause_at constant integer := 3;
	c_lock_at constant integer := 5;
	c_pause constant interval := interval '5 minutes';
	c_streak_window constant interval := interval '24 hours';
	v_email text := lower(trim(p_email));
	v_count integer;
	v_locked_until timestamptz;
begin
	-- Keep the table small: quiet streaks no longer matter (account locks stay).
	delete from public.login_attempts
	where updated_at < now() - c_streak_window and account_locked_at is null;

	insert into public.login_attempts as a (email, failed_count, updated_at)
	values (v_email, 1, now())
	on conflict (email) do update set
		failed_count = case
			when a.updated_at < now() - c_streak_window then 1
			else a.failed_count + 1
		end,
		updated_at = now()
	returning a.failed_count into v_count;

	if v_count >= c_lock_at then
		update public.login_attempts
		set account_locked_at = now(), locked_until = null
		where email = v_email;

		-- Sign the account out everywhere: its sessions, trusted browsers and code passes.
		delete from auth.sessions s using auth.users u
		where s.user_id = u.id and lower(u.email) = v_email;
		delete from public.trusted_devices d using auth.users u
		where d.user_id = u.id and lower(u.email) = v_email;
		delete from public.email_mfa_passes m using auth.users u
		where m.user_id = u.id and lower(u.email) = v_email;

		return jsonb_build_object('count', v_count, 'lockedUntil', null, 'accountLocked', true);
	end if;

	if v_count = c_pause_at then
		v_locked_until := now() + c_pause;
		update public.login_attempts set locked_until = v_locked_until where email = v_email;
	end if;

	return jsonb_build_object('count', v_count, 'lockedUntil', v_locked_until, 'accountLocked', false);
end;
$$;

revoke execute on function public.record_login_failure(text) from public, anon, authenticated;
grant execute on function public.record_login_failure(text) to service_role;

-- ----------------------------------------------------------------------------
-- set_session_expiry: cap a session's lifetime (Supabase Auth enforces not_after)
-- ----------------------------------------------------------------------------
create or replace function public.set_session_expiry(
	p_session_id uuid,
	p_user_id uuid,
	p_seconds integer
)
returns timestamptz
language sql
security definer
set search_path = ''
as $$
	update auth.sessions
	set not_after = now() + make_interval(secs => p_seconds)
	where id = p_session_id and user_id = p_user_id
	returning not_after;
$$;

revoke execute on function public.set_session_expiry(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.set_session_expiry(uuid, uuid, integer) to service_role;

-- ----------------------------------------------------------------------------
-- revoke_user_sessions: sign someone out everywhere (deactivation)
-- ----------------------------------------------------------------------------
create or replace function public.revoke_user_sessions(p_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
	delete from auth.sessions where user_id = p_user_id;
	delete from public.trusted_devices where user_id = p_user_id;
	delete from public.email_mfa_passes where user_id = p_user_id;
$$;

revoke execute on function public.revoke_user_sessions(uuid) from public, anon, authenticated;
grant execute on function public.revoke_user_sessions(uuid) to service_role;

-- ----------------------------------------------------------------------------
-- session_state: everything the proxy needs about the caller's session, in one call.
-- The user and session come from the verified JWT, never from arguments.
-- ----------------------------------------------------------------------------
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
begin
	if v_uid is null or v_sid is null then
		return jsonb_build_object('live', false);
	end if;

	select p.is_active, p.two_step_email
	into v_active, v_two_step_email
	from public.profiles p
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
		)
	);
end;
$$;

revoke execute on function public.session_state(text) from public, anon;
grant execute on function public.session_state(text) to authenticated;

-- ----------------------------------------------------------------------------
-- Custom Access Token Hook: same as before, plus `session_expires_at`
-- ----------------------------------------------------------------------------
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
	claims jsonb;
	v_role public.app_role;
	v_active boolean;
	v_name text;
	v_not_after timestamptz;
begin
	select r.role, p.is_active, p.full_name
	into v_role, v_active, v_name
	from public.profiles p
	left join public.user_roles r on r.user_id = p.id
	where p.id = (event ->> 'user_id')::uuid;

	claims := event -> 'claims';

	if v_role is not null then
		claims := jsonb_set(claims, '{user_role}', to_jsonb(v_role));
	else
		claims := jsonb_set(claims, '{user_role}', 'null'::jsonb);
	end if;

	claims := jsonb_set(claims, '{user_active}', to_jsonb(coalesce(v_active, false)));

	if v_name is not null then
		claims := jsonb_set(claims, '{full_name}', to_jsonb(v_name));
	end if;

	-- When this session must end (unix seconds), so the proxy can refuse old access tokens.
	if claims ? 'session_id' then
		select s.not_after into v_not_after
		from auth.sessions s
		where s.id = (claims ->> 'session_id')::uuid;

		if v_not_after is not null then
			claims := jsonb_set(
				claims,
				'{session_expires_at}',
				to_jsonb(floor(extract(epoch from v_not_after))::bigint)
			);
		end if;
	end if;

	event := jsonb_set(event, '{claims}', claims);
	return event;
end;
$$;

grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from public, anon, authenticated;
grant select on auth.sessions to supabase_auth_admin;
