import { appUrl } from "@/lib/appUrl";
import { createAdminClient } from "@/utils/supabase/admin";
import { TOO_SOON, canSendTo, sendEmail, type SendResult } from "./mailer";
import { passwordResetEmail, signInCodeEmail, unlockEmail } from "./templates";

/**
 * Sign-in emails. Supabase generates the code or link (generateLink never sends
 * anything) and the app emails it with nodemailer. Codes and links expire with
 * Supabase's email OTP setting (10 minutes).
 *
 * Server-only. Deliberately not a "use server" file: these take an email, so
 * they must never be callable from the browser.
 */

/** Emails a 6-digit two-step code, checked later with verifyOtp(type "email"). */
export async function sendSignInCode(email: string): Promise<SendResult> {
	if (!(await canSendTo(email, "code"))) return { ok: false, message: TOO_SOON };
	const { data, error } = await createAdminClient().auth.admin.generateLink({
		type: "magiclink",
		email,
	});
	const code = data?.properties?.email_otp;
	if (error || !code) return { ok: false, message: "Couldn't create a sign-in code. Try again." };
	return sendEmail(signInCodeEmail(email, code));
}

/** After an MD or GM unlocks an account: a one-time sign-in link to Security settings. */
export async function sendUnlockLink(email: string): Promise<SendResult> {
	if (!(await canSendTo(email, "unlock"))) return { ok: false, message: TOO_SOON };
	const { data, error } = await createAdminClient().auth.admin.generateLink({
		type: "magiclink",
		email,
	});
	const hash = data?.properties?.hashed_token;
	if (error || !hash) return { ok: false, message: "Couldn't create a sign-in link. Try again." };
	const link = `${await appUrl()}/auth/confirm?token_hash=${hash}&type=magiclink&next=${encodeURIComponent("/settings/security")}`;
	return sendEmail(unlockEmail(email, link));
}

/**
 * A password reset link. Reports success for an email with no account too, so
 * the reset form doesn't reveal which emails have accounts.
 */
export async function sendPasswordReset(email: string): Promise<SendResult> {
	if (!(await canSendTo(email, "reset"))) return { ok: false, message: TOO_SOON };
	const { data, error } = await createAdminClient().auth.admin.generateLink({
		type: "recovery",
		email,
	});
	const hash = data?.properties?.hashed_token;
	if (error || !hash) return { ok: true };
	const link = `${await appUrl()}/auth/confirm?token_hash=${hash}&type=recovery&next=${encodeURIComponent("/forgot-password?mode=reset")}`;
	return sendEmail(passwordResetEmail(email, link));
}
