import nodemailer, { type Transporter } from "nodemailer";
import { createAdminClient } from "@/utils/supabase/admin";

/**
 * The app's own email sending (nodemailer over SMTP). Supabase sends nothing:
 * the server asks Supabase for a code or link without sending it, then emails
 * it from here. Server-only.
 *
 * Environment:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD  your mail server
 *   SMTP_SECURE   "true" for TLS from the start (port 465); otherwise STARTTLS
 *   EMAIL_FROM    e.g. "Majeurs <no-reply@majeursholdings.com>"
 */

export type Email = { to: string; subject: string; html: string; text: string };
export type SendResult = { ok: true } | { ok: false; message: string };

let transporter: Transporter | null = null;

function transport(): Transporter {
	if (transporter) return transporter;
	const host = process.env.SMTP_HOST;
	if (!host || !process.env.EMAIL_FROM) {
		throw new Error(
			"Email isn't set up: add SMTP_HOST and EMAIL_FROM to the server environment.",
		);
	}
	const port = Number(process.env.SMTP_PORT || 587);
	transporter = nodemailer.createTransport({
		host,
		port,
		secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
		auth: process.env.SMTP_USER
			? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
			: undefined,
	});
	return transporter;
}

/** Sends one email. Never throws: a failure comes back as a message to show. */
export async function sendEmail(email: Email): Promise<SendResult> {
	try {
		await transport().sendMail({ from: process.env.EMAIL_FROM, ...email });
		return { ok: true };
	} catch (error) {
		console.error("Email failed", error);
		return { ok: false, message: "The email couldn't be sent. Try again in a moment." };
	}
}

export type EmailPurpose = "code" | "invite" | "unlock" | "reset";

const WAIT_SECONDS: Record<EmailPurpose, number> = { code: 30, invite: 30, unlock: 30, reset: 60 };

/**
 * One email of each kind per address per short window (see claim_email_send),
 * so nobody can flood someone's inbox. Only that address is affected.
 */
export async function canSendTo(email: string, purpose: EmailPurpose): Promise<boolean> {
	const { data, error } = await createAdminClient().rpc("claim_email_send", {
		p_email: email.toLowerCase(),
		p_purpose: purpose,
		p_seconds: WAIT_SECONDS[purpose],
	});
	// If the check itself fails, don't block the email
	return error ? true : data === true;
}

export const TOO_SOON = "An email went out a moment ago. Wait a minute, then try again.";
