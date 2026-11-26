import { createAdminClient } from "@/utils/supabase/admin";

/**
 * Wrong-password locks, per email (see record_login_failure). Only the email
 * being guessed is affected: nobody else on the same network or in the app.
 *
 * - 3 wrong passwords: sign-in for that email pauses for 5 minutes.
 * - 2 more: the account is locked and signed out everywhere, until the MD or
 *   GM unlocks it in Team & access, which emails the person a sign-in link.
 *
 * Server-only. Deliberately not a "use server" file: these take an email, so
 * they must never be callable from the browser.
 */

export const ACCOUNT_LOCKED_MESSAGE =
	"This account is locked after too many incorrect passwords. Ask your MD or GM to unlock it in Team & access. They'll email you a sign-in link.";

function minutesUntil(when: Date): number {
	return Math.max(1, Math.ceil((when.getTime() - Date.now()) / 60_000));
}

function plural(n: number, word: string) {
	return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** Why this email can't try a password right now, or null if it can. */
export async function lockMessage(email: string): Promise<string | null> {
	const { data } = await createAdminClient()
		.from("login_attempts")
		.select("locked_until, account_locked_at")
		.eq("email", email.toLowerCase())
		.maybeSingle();
	if (data?.account_locked_at) return ACCOUNT_LOCKED_MESSAGE;
	if (data?.locked_until && new Date(data.locked_until) > new Date()) {
		return `Too many incorrect attempts. Try again in ${plural(minutesUntil(new Date(data.locked_until)), "minute")}.`;
	}
	return null;
}

/** Counts a wrong password and says what happens next. */
export async function recordWrongPassword(email: string): Promise<string> {
	const { data } = await createAdminClient().rpc("record_login_failure", {
		p_email: email.toLowerCase(),
	});
	const result = data as { count?: number; lockedUntil?: string | null; accountLocked?: boolean };

	if (result?.accountLocked) {
		return "Too many incorrect attempts. This account is now locked. Ask your MD or GM to unlock it in Team & access. They'll email you a sign-in link.";
	}
	if (result?.lockedUntil) {
		return `Too many incorrect attempts. Sign-in is paused for ${plural(minutesUntil(new Date(result.lockedUntil)), "minute")}.`;
	}
	if (result?.count === 2) {
		return "Incorrect email or password. One more wrong attempt pauses sign-in for 5 minutes.";
	}
	if (result?.count === 4) {
		return "Incorrect email or password. One more wrong attempt locks this account and signs it out everywhere until your MD or GM unlocks it.";
	}
	return "Incorrect email or password. Try again or reset your password.";
}

/** A correct password ends the streak. Never clears an account lock. */
export async function clearWrongPasswords(email: string) {
	await createAdminClient()
		.from("login_attempts")
		.delete()
		.eq("email", email.toLowerCase())
		.is("account_locked_at", null);
}

/** Whether the account behind this email is locked (MD or GM must unlock). */
export async function isAccountLocked(email: string): Promise<boolean> {
	const { data } = await createAdminClient()
		.from("login_attempts")
		.select("account_locked_at")
		.eq("email", email.toLowerCase())
		.maybeSingle();
	return Boolean(data?.account_locked_at);
}
