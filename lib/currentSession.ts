import { cookies } from "next/headers";
import { TRUSTED_DEVICE_COOKIE } from "@/lib/sessionPolicy";
import { sessionState } from "@/lib/twoStep";
import { createClient } from "@/utils/supabase/server";

/**
 * The signed-in person for a server action: their Supabase client, user,
 * verified claims, and session state. Null when the session isn't live or the
 * account isn't active. (Not a "use server" file: it's only called from actions.)
 */
export async function currentSession() {
	const supabase = await createClient();
	const [{ data: userData }, { data: claimsData }, cookieStore] = await Promise.all([
		supabase.auth.getUser(),
		supabase.auth.getClaims(),
		cookies(),
	]);
	const user = userData.user;
	const claims = claimsData?.claims;
	if (!user?.email || !claims) return null;

	const sessionId = typeof claims.session_id === "string" ? claims.session_id : undefined;
	const state = await sessionState(supabase, {
		aal: typeof claims.aal === "string" ? claims.aal : undefined,
		deviceToken: cookieStore.get(TRUSTED_DEVICE_COOKIE)?.value,
	});
	if (!state.live || !state.active || state.accountLocked) return null;
	return { supabase, user, claims, email: user.email, sessionId, ...state };
}
