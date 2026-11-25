"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { secondStepOwed } from "@/lib/twoStep";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";

export type TwoStepResult = { ok: true } | { ok: false; message: string };

const codeSchema = z
	.string()
	.trim()
	.regex(/^\d{6}$/, "Enter the 6-digit code.");

/**
 * A client that isn't tied to the person's cookies: sending and checking an
 * email code through it never replaces the session they're signed in with.
 */
function throwawayClient() {
	return createSupabaseClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
		{ auth: { persistSession: false, autoRefreshToken: false } },
	);
}

/** The signed-in person, their current session, and whether they still owe a second step. */
async function currentSession() {
	const supabase = await createClient();
	const [{ data: userData }, { data: claimsData }] = await Promise.all([
		supabase.auth.getUser(),
		supabase.auth.getClaims(),
	]);
	const user = userData.user;
	const claims = claimsData?.claims;
	if (!user?.email || !claims) return null;

	const hasApp = Boolean(
		user.factors?.some((f) => f.factor_type === "totp" && f.status === "verified"),
	);
	const sessionId = typeof claims.session_id === "string" ? claims.session_id : undefined;
	const state = await secondStepOwed(supabase, {
		userId: user.id,
		sessionId,
		aal: typeof claims.aal === "string" ? claims.aal : undefined,
		hasApp,
	});
	return { supabase, user, email: user.email, sessionId, ...state };
}

/** Checks an emailed code, then ends the throwaway session the check created. */
async function codeIsValid(email: string, code: string) {
	const client = throwawayClient();
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

	const { error } = await throwawayClient().auth.signInWithOtp({
		email: session.email,
		options: { shouldCreateUser: false },
	});
	if (error) {
		return {
			ok: false,
			message: /rate|seconds/i.test(error.message)
				? "A code was sent a moment ago. Wait a minute, then send a new one."
				: error.message,
		};
	}
	return { ok: true };
}

/** Sign-in: passes the second step with an emailed code (when email codes are on). */
export async function verifyEmailCode(rawCode: string): Promise<TwoStepResult> {
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
