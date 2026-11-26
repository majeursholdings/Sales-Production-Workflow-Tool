"use server";

import dayjs from "dayjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentSession } from "@/lib/currentSession";
import { getSignInPolicy } from "@/lib/data/companySettings";
import { clearWrongPasswords, lockMessage, recordWrongPassword } from "@/lib/loginLock";
import { passwordProblem } from "@/lib/passwordRules";
import { forgetTrustedDevices } from "@/lib/trustedDevices";
import { createAdminClient } from "@/utils/supabase/admin";
import { createThrowawayClient } from "@/utils/supabase/server";

/**
 * Security settings: password, sessions and the authenticator app. Run on the
 * server, as the signed-in person, only from a session that has passed its
 * second step.
 */

export type SecurityResult = { ok: true } | { ok: false; message: string };
export type TotpEnrollment = { factorId: string; qrCode: string; secret: string };

const EXPIRED = "Your session expired. Sign in again.";
const FINISH_FIRST = "Finish signing in with your current method first.";

const codeSchema = z
	.string()
	.trim()
	.regex(/^\d{6}$/, "Enter the 6-digit code.");
const factorIdSchema = z.string().uuid();

/** The signed-in person, if their session is live and has passed its second step. */
async function settledSession() {
	const session = await currentSession();
	if (!session) return { ok: false as const, message: EXPIRED };
	if (session.owed) return { ok: false as const, message: FINISH_FIRST };
	return { ok: true as const, session };
}

/**
 * Changes the password after checking the current one. The new one must meet
 * the stronger rules (lib/passwordRules). A wrong current password counts
 * towards the same lock as signing in. Other devices are signed out, other
 * trusted browsers forgotten, and a pending lockout review is answered.
 */
export async function changePassword(input: {
	current: string;
	password: string;
}): Promise<SecurityResult> {
	const parsed = z.object({ current: z.string().min(1), password: z.string() }).safeParse(input);
	if (!parsed.success) return { ok: false, message: "Enter your current password." };
	const result = await settledSession();
	if (!result.ok) return result;
	const { session } = result;
	const email = session.email.toLowerCase();

	const problem = passwordProblem(parsed.data.password, email);
	if (problem) return { ok: false, message: problem };
	if (parsed.data.password === parsed.data.current) {
		return { ok: false, message: "Choose a password you haven't used here." };
	}
	const admin = createAdminClient();

	const locked = await lockMessage(email);
	if (locked) return { ok: false, message: locked };

	// Check the current password on a separate client so this session isn't replaced.
	const checker = await createThrowawayClient();
	const { error: checkError } = await checker.auth.signInWithPassword({
		email,
		password: parsed.data.current,
	});
	if (checkError) {
		if (checkError.code === "invalid_credentials") {
			const next = await recordWrongPassword(email);
			// Same counter as sign-in, so say so once it starts pausing or locking
			return {
				ok: false,
				message: next.startsWith("Too many") ? next : "Your current password isn't right.",
			};
		}
		return { ok: false, message: "Couldn't check your current password. Try again." };
	}
	await checker.auth.signOut({ scope: "local" });

	// Through the person's own session: Supabase keeps this session and ends the
	// others. (The admin API would sign this device out too.)
	const { error } = await session.supabase.auth.updateUser({ password: parsed.data.password });
	if (error) {
		// Supabase can insist on a fresh second step (e.g. on a trusted browser)
		return {
			ok: false,
			message:
				error.code === "insufficient_aal"
					? "Sign out and back in with your authenticator app, then change your password."
					: error.message,
		};
	}

	await Promise.all([
		session.supabase.auth.signOut({ scope: "others" }),
		forgetTrustedDevices(session.user.id, true),
		clearWrongPasswords(email),
		admin.from("lockout_reviews").delete().eq("user_id", session.user.id),
	]);
	revalidatePath("/settings/security");
	return { ok: true };
}

/**
 * After an unlock: the person says the lockout was them (they mistyped), so
 * nothing more is asked. If it wasn't them, they change their password instead,
 * which also clears the review.
 */
export async function confirmLockoutWasMe(): Promise<SecurityResult> {
	const result = await settledSession();
	if (!result.ok) return result;
	const { session } = result;
	await createAdminClient().from("lockout_reviews").delete().eq("user_id", session.user.id);
	await session.supabase.from("audit_logs").insert({
		actor_id: session.user.id,
		action: "lockout.confirmed_by_owner",
		entity_type: "profile",
		entity_id: session.user.id,
	});
	revalidatePath("/settings/security");
	return { ok: true };
}

/** Signs out every other session and forgets other trusted browsers. */
export async function signOutOtherDevices(): Promise<SecurityResult> {
	const result = await settledSession();
	if (!result.ok) return result;
	const { session } = result;

	const { error } = await session.supabase.auth.signOut({ scope: "others" });
	if (error) return { ok: false, message: error.message };
	await forgetTrustedDevices(session.user.id, true);
	return { ok: true };
}

/** Starts adding an authenticator app: returns the QR code and key to scan. */
export async function startTotpEnroll(): Promise<
	{ ok: true; enrollment: TotpEnrollment } | { ok: false; message: string }
> {
	const result = await settledSession();
	if (!result.ok) return result;

	const { data, error } = await result.session.supabase.auth.mfa.enroll({
		factorType: "totp",
		friendlyName: `Authenticator app ${dayjs().format("D MMM YYYY HH:mm")}`,
	});
	if (error || !data) {
		return {
			ok: false,
			message: error?.message ?? "Could not start two-step verification setup.",
		};
	}
	return {
		ok: true,
		enrollment: { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret },
	};
}

/** Drops an unfinished app setup so setting up again later starts clean. */
export async function cancelTotpEnroll(factorId: string): Promise<SecurityResult> {
	const id = factorIdSchema.safeParse(factorId);
	if (!id.success) return { ok: false, message: "Invalid request." };
	const result = await settledSession();
	if (!result.ok) return result;
	const { session } = result;

	const factor = session.user.factors?.find((f) => f.id === id.data);
	if (!factor || factor.status === "verified") {
		return { ok: false, message: "No unfinished authenticator setup matches that request." };
	}

	const { error } = await session.supabase.auth.mfa.unenroll({ factorId: id.data });
	if (error) return { ok: false, message: error.message };
	return { ok: true };
}

/** Finishes adding the app with the first code it shows. */
export async function confirmTotpEnroll(
	factorId: string,
	rawCode: string,
): Promise<SecurityResult> {
	const id = factorIdSchema.safeParse(factorId);
	const code = codeSchema.safeParse(rawCode);
	if (!id.success || !code.success) return { ok: false, message: "Enter the 6-digit code." };
	const result = await settledSession();
	if (!result.ok) return result;

	const { error } = await result.session.supabase.auth.mfa.challengeAndVerify({
		factorId: id.data,
		code: code.data,
	});
	if (error) {
		return {
			ok: false,
			message: "That code didn't work. Codes change every 30 seconds, so use the newest one.",
		};
	}
	revalidatePath("/settings/security");
	return { ok: true };
}

/**
 * Removes the person's own authenticator app. Done with the admin API after
 * checking the factor is theirs, so it also works from a trusted browser
 * (where the session is AAL1, which Supabase would otherwise refuse).
 */
export async function removeTotpFactor(factorId: string): Promise<SecurityResult> {
	const id = factorIdSchema.safeParse(factorId);
	if (!id.success) return { ok: false, message: "Invalid request." };
	const result = await settledSession();
	if (!result.ok) return result;
	const { session } = result;

	const owns = session.user.factors?.some((factor) => factor.id === id.data);
	if (!owns) return { ok: false, message: "That authenticator app isn't on your account." };

	const { requireTwoStep } = await getSignInPolicy();
	if (requireTwoStep) {
		const otherVerifiedApp = session.user.factors?.some(
			(factor) =>
				factor.id !== id.data &&
				factor.factor_type === "totp" &&
				factor.status === "verified",
		);
		if (!otherVerifiedApp && !session.hasEmail) {
			return {
				ok: false,
				message:
					"Company policy requires two-step verification. Turn on email codes or add another authenticator app before removing this one.",
			};
		}
	}

	const { error } = await createAdminClient().auth.admin.mfa.deleteFactor({
		id: id.data,
		userId: session.user.id,
	});
	if (error) return { ok: false, message: error.message };

	await session.supabase.from("audit_logs").insert({
		actor_id: session.user.id,
		action: "two_step.app_removed",
		entity_type: "profile",
		entity_id: session.user.id,
	});
	revalidatePath("/settings/security");
	return { ok: true };
}
