import { randomBytes } from "node:crypto";
import { appUrl } from "@/lib/appUrl";
import { sendEmail, TOO_SOON, canSendTo, type SendResult } from "@/lib/email/mailer";
import { inviteEmail } from "@/lib/email/templates";
import { tokenHash } from "@/lib/trustedDevices";
import { createAdminClient } from "@/utils/supabase/admin";

/**
 * Invites: the MD or GM sets name, email and role; the person gets a link to
 * set their own password. The link carries our own token (valid 48 hours; only
 * its hash is stored) and is emailed by the app (nodemailer).
 *
 * Server-only. Deliberately not a "use server" file: these take a user id.
 */

export const INVITE_HOURS = 48;

/** Issues a fresh invite link (replacing any earlier one) and emails it. */
export async function sendInvite(
	userId: string,
	email: string,
	fullName: string,
): Promise<SendResult> {
	if (!(await canSendTo(email, "invite"))) return { ok: false, message: TOO_SOON };

	const token = randomBytes(32).toString("base64url");
	const expiresAt = new Date(Date.now() + INVITE_HOURS * 60 * 60 * 1000);
	const { error } = await createAdminClient()
		.from("pending_invites")
		.upsert({
			user_id: userId,
			token_hash: tokenHash(token),
			expires_at: expiresAt.toISOString(),
			created_at: new Date().toISOString(),
		});
	if (error) return { ok: false, message: error.message };

	const link = `${await appUrl()}/auth/invite?token=${token}`;
	return sendEmail(inviteEmail(email, fullName, link));
}

/** The account an unexpired invite token belongs to, or null. */
export async function inviteOwner(token: string): Promise<{ userId: string } | null> {
	const { data } = await createAdminClient()
		.from("pending_invites")
		.select("user_id, expires_at")
		.eq("token_hash", tokenHash(token))
		.maybeSingle();
	if (!data || new Date(data.expires_at) <= new Date()) return null;
	return { userId: data.user_id };
}

/** Whether this person still has an invite to accept (no password set yet). */
export async function hasPendingInvite(userId: string): Promise<boolean> {
	const { data } = await createAdminClient()
		.from("pending_invites")
		.select("user_id")
		.eq("user_id", userId)
		.maybeSingle();
	return Boolean(data);
}

/** Invite used: forget the token. */
export async function finishInvite(userId: string) {
	await createAdminClient().from("pending_invites").delete().eq("user_id", userId);
}
