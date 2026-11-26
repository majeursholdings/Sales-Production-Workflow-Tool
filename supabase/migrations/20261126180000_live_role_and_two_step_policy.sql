-- ============================================================================
-- 1. Live DB role in private.current_user_role()
--    Always resolve the user's active role from public.profiles +
--    public.user_roles instead of trusting a potentially stale JWT `user_role`
--    claim. Role changes and demotions now take effect in every RLS policy
--    immediately rather than waiting for JWT expiry.
--
-- 2. Allow quote creators to delete their own unsent draft quotes so draft
--    deletion in the Quotes table persists to Postgres under RLS.
-- ============================================================================

create or replace function private.current_user_role()
returns public.app_role
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_uid uuid := (select auth.uid());
	v_active boolean;
	v_role public.app_role;
begin
	if v_uid is null then
		return null;
	end if;

	select p.is_active, r.role
	into v_active, v_role
	from public.profiles p
	left join public.user_roles r on r.user_id = p.id
	where p.id = v_uid;

	if coalesce(v_active, false) = false then
		return null;
	end if;

	return v_role;
end;
$$;

revoke all on function private.current_user_role() from public, anon;
grant execute on function private.current_user_role() to authenticated, service_role;

drop policy if exists "Quote creators can delete own draft quotes" on public.quotes;
create policy "Quote creators can delete own draft quotes"
	on public.quotes for delete to authenticated
	using (
		status = 'draft'
		and (select private.authorize('quotes.create'))
		and (created_by = (select auth.uid()) or created_by is null)
	);
