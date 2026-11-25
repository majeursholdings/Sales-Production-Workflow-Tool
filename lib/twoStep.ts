import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Whether a signed-in session still owes its second step.
 *
 * - Authenticator app set up: passed when the session is AAL2, or (if email
 *   codes are also on) when the session passed an email code.
 * - Email codes only: passed when the session passed an email code.
 * - Neither: nothing owed.
 *
 * Works with any Supabase client acting as the person (proxy, server, browser).
 * A missing column or table (migration not applied yet) reads as "email off".
 */
export async function secondStepOwed(
	supabase: SupabaseClient,
	{
		userId,
		sessionId,
		aal,
		hasApp,
	}: { userId: string; sessionId: string | undefined; aal: string | undefined; hasApp: boolean },
): Promise<{ owed: boolean; hasApp: boolean; hasEmail: boolean }> {
	if (hasApp && aal === "aal2") return { owed: false, hasApp, hasEmail: false };

	const [{ data: profile }, { data: pass }] = await Promise.all([
		supabase.from("profiles").select("two_step_email").eq("id", userId).maybeSingle(),
		sessionId
			? supabase
					.from("email_mfa_passes")
					.select("session_id")
					.eq("session_id", sessionId)
					.maybeSingle()
			: Promise.resolve({ data: null }),
	]);

	const hasEmail = Boolean(profile?.two_step_email);
	const passedEmail = hasEmail && Boolean(pass);
	const owed = (hasApp || hasEmail) && !passedEmail;
	return { owed, hasApp, hasEmail };
}
