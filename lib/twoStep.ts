import type { SupabaseClient } from "@supabase/supabase-js";

export type SessionState = {
	/** The session still exists in Supabase Auth and isn't past its end time. */
	live: boolean;
	/** The account is active (not deactivated, not deleted). */
	active: boolean;
	/** Locked after 5 wrong passwords (all its sessions were signed out). */
	accountLocked: boolean;
	/** Unlocked by the MD or GM; the person hasn't said whether the lockout was them. */
	lockoutReview: boolean;
	/** Signed in from an invite and hasn't set a password yet. */
	needsPassword: boolean;
	/** The session still owes its second step. */
	owed: boolean;
	hasApp: boolean;
	/** Email codes are turned on in settings. */
	hasEmail: boolean;
	/** This browser is trusted to skip the second step. */
	trustedDevice: boolean;
};

type RawState = {
	live?: boolean;
	active?: boolean;
	accountLocked?: boolean;
	lockoutReview?: boolean;
	needsPassword?: boolean;
	hasApp?: boolean;
	twoStepEmail?: boolean;
	emailPassed?: boolean;
	trustedDevice?: boolean;
};

/**
 * Everything about the signed-in session in one database call (session_state):
 * whether it's still live, whether the account is active or locked, and whether
 * it owes its second step.
 *
 * - Authenticator app set up: passed when the session is AAL2, or (if email
 *   codes are also on) when the session passed an email code.
 * - Email codes only: passed when the session passed an email code.
 * - Trusted device: skips the second step for 30 days.
 *
 * Throws when the check can't be made, so callers fail closed.
 */
export async function sessionState(
	supabase: SupabaseClient,
	{
		aal,
		deviceToken,
	}: {
		aal: string | undefined;
		/** The trusted-device cookie, if this browser has one. */
		deviceToken: string | undefined;
	},
): Promise<SessionState> {
	const { data, error } = await supabase.rpc("session_state", {
		p_device_token: deviceToken ?? null,
	});
	if (error) throw new Error(`Couldn't check the session: ${error.message}`);
	const raw = (data ?? {}) as RawState;

	const hasApp = raw.hasApp === true;
	const hasEmail = raw.twoStepEmail === true;
	const trustedDevice = raw.trustedDevice === true;
	const passed = (hasApp && aal === "aal2") || (hasEmail && raw.emailPassed === true);

	return {
		live: raw.live === true,
		active: raw.active === true,
		accountLocked: raw.accountLocked === true,
		lockoutReview: raw.lockoutReview === true,
		needsPassword: raw.needsPassword === true,
		owed: (hasApp || hasEmail) && !passed && !trustedDevice,
		hasApp,
		hasEmail,
		trustedDevice,
	};
}
