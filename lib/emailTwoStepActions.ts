"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { currentSession } from "@/lib/currentSession";
import { sendSignInCode } from "@/lib/email/authEmails";
import {
	TRUSTED_DEVICE_COOKIE,
	TRUSTED_DEVICE_SECONDS,
	trustedDeviceCookieOptions,
} from "@/lib/sessionPolicy";
import { tokenHash } from "@/lib/trustedDevices";
import { createAdminClient } from "@/utils/supabase/admin";
import { createThrowawayClient, requestInfo } from "@/utils/supabase/server";

export type TwoStepResult = { ok: true } | { ok: false; message: string };

const codeSchema = z
	.string()
	.trim()
	.regex(/^\d{6}$/, "Enter the 6-digit code.");

/** Checks an emailed code, then ends the throwaway session the check created. */
async function codeIsValid(email: string, code: string) {
	const client = await createThrowawayClient();
	const { data, error } = await client.auth.verifyOtp({ email, token: code, type: "email" });
	if (error || !data.session) return false;
	await client.auth.signOut({ scope: "local" });
	return true;
}

/** Records that this session passed an email code. */
async function recordPass(userId: string, sessionId: string) {
	const admin = createAdminClient();
	const { error } = await admin
		.from("email_mfa_passes")
		.upsert({ session_id: sessionId, user_id: userId, verified_at: new Date().toISOString() });
	return error;
}

/** Emails the signed-in person a 6-digit code. */
export async function sendEmailCode(): Promise<TwoStepResult> {
	const session = await currentSession();
	if (!session) return { ok: false, message: "Your session expired. Sign in again." };

	return sendSignInCode(session.email);
}

/** After the second step passes: if asked, trusts this browser for 30 days. */
async function afterSecondStep(userId: string, trustDevice: boolean) {
	if (!trustDevice) return;
	const admin = createAdminClient();

	const token = randomBytes(32).toString("base64url");
	const expiresAt = new Date(Date.now() + TRUSTED_DEVICE_SECONDS * 1000);
	const { error } = await admin.from("trusted_devices").insert({
		token_hash: tokenHash(token),
		user_id: userId,
		expires_at: expiresAt.toISOString(),
	});
	if (error) return;

	const [cookieStore, { secure }] = await Promise.all([cookies(), requestInfo()]);
	cookieStore.set(TRUSTED_DEVICE_COOKIE, token, trustedDeviceCookieOptions(secure));
}

/** Sign-in: passes the second step with an emailed code. */
export async function verifyEmailCode(
	rawCode: string,
	trustDevice = false,
): Promise<TwoStepResult> {
	const parsed = codeSchema.safeParse(rawCode);
	if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

	const session = await currentSession();
	if (!session?.sessionId) return { ok: false, message: "Your session expired. Sign in again." };
	if (!session.hasEmail) {
		return {
			ok: false,
			message: "Email codes aren't turned on for your account. Use your authenticator app.",
		};
	}
	if (!(await codeIsValid(session.email, parsed.data))) {
		return { ok: false, message: "That code is invalid or expired. Send a new one." };
	}

	const error = await recordPass(session.user.id, session.sessionId);
	if (error) return { ok: false, message: "Couldn't finish signing in. Try again." };
	await afterSecondStep(session.user.id, trustDevice);
	return { ok: true };
}

/** Sign-in: passes the second step with a code from the authenticator app. */
export async function verifyAppCode(rawCode: string, trustDevice = false): Promise<TwoStepResult> {
	const parsed = codeSchema.safeParse(rawCode);
	if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

	const session = await currentSession();
	if (!session) return { ok: false, message: "Your session expired. Sign in again." };

	const { data: factors, error: listError } = await session.supabase.auth.mfa.listFactors();
	if (listError) return { ok: false, message: listError.message };
	const totpFactor = factors?.totp.find((factor) => factor.status === "verified");
	if (!totpFactor) {
		return { ok: false, message: "No authenticator app is set up for this account." };
	}

	// Raises this session to AAL2; the new tokens are written to the cookies.
	const { error } = await session.supabase.auth.mfa.challengeAndVerify({
		factorId: totpFactor.id,
		code: parsed.data,
	});
	if (error) {
		return { ok: false, message: "That code didn't work. Check your app and try again." };
	}

	await afterSecondStep(session.user.id, trustDevice);
	return { ok: true };
}

/** Settings: turns on email codes once the person proves they get them. */
export async function enableEmailTwoStep(rawCode: string): Promise<TwoStepResult> {
	const parsed = codeSchema.safeParse(rawCode);
	if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

	const session = await currentSession();
	if (!session?.sessionId) return { ok: false, message: "Your session expired. Sign in again." };
	if (session.owed) {
		return { ok: false, message: "Finish signing in with your current method first." };
	}
	if (!(await codeIsValid(session.email, parsed.data))) {
		return { ok: false, message: "That code is invalid or expired. Send a new one." };
	}

	const admin = createAdminClient();
	const { error } = await admin
		.from("profiles")
		.update({ two_step_email: true })
		.eq("id", session.user.id);
	if (error) return { ok: false, message: error.message };

	// This session has just passed an email code, so it isn't sent back to /verify
	await recordPass(session.user.id, session.sessionId);
	await session.supabase.from("audit_logs").insert({
		actor_id: session.user.id,
		action: "two_step.email_enabled",
		entity_type: "profile",
		entity_id: session.user.id,
	});

	revalidatePath("/settings/security");
	return { ok: true };
}

/** Settings: turns off email codes. Only from a session that has passed its second step. */
export async function disableEmailTwoStep(): Promise<TwoStepResult> {
	const session = await currentSession();
	if (!session) return { ok: false, message: "Your session expired. Sign in again." };
	if (session.owed) {
		return { ok: false, message: "Finish signing in with your current method first." };
	}

	const admin = createAdminClient();
	const [{ error }] = await Promise.all([
		admin.from("profiles").update({ two_step_email: false }).eq("id", session.user.id),
		admin.from("email_mfa_passes").delete().eq("user_id", session.user.id),
	]);
	if (error) return { ok: false, message: error.message };

	await session.supabase.from("audit_logs").insert({
		actor_id: session.user.id,
		action: "two_step.email_disabled",
		entity_type: "profile",
		entity_id: session.user.id,
	});

	revalidatePath("/settings/security");
	return { ok: true };
}
