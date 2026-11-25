-- Two-step verification by email code.
--
-- Supabase MFA has authenticator-app (TOTP) and phone factors but no email
-- factor, so email codes are tracked here: a per-person switch, and a record
-- of each sign-in session that has passed an email code. The app's server
-- actions send and check the code (through Supabase Auth's email OTP on a
-- throwaway client, so the person's own session isn't replaced) and write
-- these rows with the service role. People can't write them themselves.

alter table public.profiles
	add column two_step_email boolean not null default false;

comment on column public.profiles.two_step_email is
	'Two-step verification by email code is on. Changed only by the server (service role).';

-- Only the server may turn email codes on or off, so a signed-in person can't
-- switch their own second step off without passing it first.
create or replace function private.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	if current_user = 'authenticated' then
		if new.two_step_email is distinct from old.two_step_email then
			raise exception 'Two-step verification by email can only be changed from Security settings';
		end if;
		if not private.authorize('users.manage') then
			if new.is_active is distinct from old.is_active then
				raise exception 'Only MD or GM can change account active status';
			end if;
			if new.email is distinct from old.email then
				raise exception 'Email can only be changed through authentication settings';
			end if;
		end if;
	end if;
	return new;
end;
$$;

create table public.email_mfa_passes (
	-- The auth session (JWT session_id claim) that passed an email code.
	session_id uuid primary key,
	user_id uuid not null references auth.users (id) on delete cascade,
	verified_at timestamptz not null default now()
);

comment on table public.email_mfa_passes is
	'Sign-in sessions that passed a two-step email code. Written only by the service role.';

create index email_mfa_passes_user_id_idx on public.email_mfa_passes (user_id);

alter table public.email_mfa_passes enable row level security;

revoke all on public.email_mfa_passes from anon, authenticated;
grant select on public.email_mfa_passes to authenticated;

-- People can see their own passes (the proxy checks the current session's);
-- there are no insert, update or delete policies, so only the service role writes.
create policy "Users can read own email passes"
	on public.email_mfa_passes
	for select
	to authenticated
	using (user_id = (select auth.uid()));
