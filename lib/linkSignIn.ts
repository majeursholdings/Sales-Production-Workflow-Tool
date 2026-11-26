import { cookies } from "next/headers";
import { getSignInPolicy } from "@/lib/data/companySettings";
import {
	REMEMBER_COOKIE,
	rememberCookieOptions,
	sessionLifetimeSeconds,
} from "@/lib/sessionPolicy";
import { createAdminClient } from "@/utils/supabase/admin";
import { requestInfo, type createClient } from "@/utils/supabase/server";

/**
 * After an emailed link opens a session: it gets the company's short session lifetime.
 * A sign-in or invite link proves the person has the email, so `countsAsEmailCode`
 * records the session as having passed an email code; an authenticator app, if
 * set up, is still asked for.
 */
export async function afterLinkSignIn(
	supabase: Awaited<ReturnType<typeof createClient>>,
	countsAsEmailCode: boolean,
) {
	const { data } = await supabase.auth.getClaims();
	const claims = data?.claims;
	const sessionId = typeof claims?.session_id === "string" ? claims.session_id : null;
	if (!claims || !sessionId) return;

	const admin = createAdminClient();
	const [{ secure }, { idleHours }] = await Promise.all([requestInfo(), getSignInPolicy()]);
	(await cookies()).set(REMEMBER_COOKIE, "0", rememberCookieOptions(false, secure));
	await admin.rpc("set_session_expiry", {
		p_session_id: sessionId,
		p_user_id: claims.sub,
		p_seconds: sessionLifetimeSeconds(false, idleHours),
	});
	if (countsAsEmailCode) {
		await admin.from("email_mfa_passes").upsert({
			session_id: sessionId,
			user_id: claims.sub,
			verified_at: new Date().toISOString(),
		});
	}
}
