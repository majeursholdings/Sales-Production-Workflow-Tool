"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { currentSession } from "@/lib/currentSession";
import { getSignInPolicy } from "@/lib/data/companySettings";
import { sendEmailCode, verifyAppCode, verifyEmailCode } from "@/lib/emailTwoStepActions";
import { sendPasswordReset } from "@/lib/email/authEmails";
import { finishInvite } from "@/lib/invites";
import {
	ACCOUNT_LOCKED_MESSAGE,
	clearWrongPasswords,
	isAccountLocked,
	lockMessage,
	recordWrongPassword,
} from "@/lib/loginLock";
import { passwordProblem } from "@/lib/passwordRules";
import { isAppRole } from "@/lib/roles";
import {
	REMEMBER_COOKIE,
	TRUSTED_DEVICE_COOKIE,
	rememberCookieOptions,
	sessionLifetimeSeconds,
} from "@/lib/sessionPolicy";
import { forgetTrustedDevices } from "@/lib/trustedDevices";
import { sessionState } from "@/lib/twoStep";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient, requestInfo } from "@/utils/supabase/server";

/**
 * Sign-in, second step, password reset and sign-out. All run on the server:
 * the browser never gets a Supabase key or reads the (HttpOnly) session cookies.
 */

export type AuthResult = { ok: true } | { ok: false; message: string };
/** Which second-step methods the person can use for this sign-in. */
export type TwoStepMethods = { app: boolean; email: boolean };
export type SignInResult =
	{ ok: true; requiresMfa: boolean; methods: TwoStepMethods } | { ok: false; message: string };
export type VerifyMethod = "app" | "email";

const inputSchema = z.object({
	email: z.string().trim().toLowerCase().min(1),
	password: z.string().min(1),
	remember: z.boolean(),
});

/**
 * Signs in with email and password on the server (the browser never talks to
 * Supabase), so the wrong-password locks can't be skipped. Sets the session's lifetime from "Keep me signed
 * in" and reports whether a second step is owed.
 */
export async function signIn(input: {
	email: string;
	password: string;
	remember: boolean;
}): Promise<SignInResult> {
	const parsed = inputSchema.safeParse(input);
	if (!parsed.success) return { ok: false, message: "Enter your work email and password." };
	const { email, password, remember } = parsed.data;

	const admin = createAdminClient();
	const [cookieStore, { secure }] = await Promise.all([cookies(), requestInfo()]);

	// Paused (3 wrong) or locked (5 wrong): don't check the password at all.
	const locked = await lockMessage(email);
	if (locked) return { ok: false, message: locked };

	const supabase = await createClient({ remember });

	const { data, error } = await supabase.auth.signInWithPassword({ email, password });
	if (error || !data.user || !data.session) {
		const wrongPassword =
			error?.code === "invalid_credentials" || error?.message === "Invalid login credentials";
		return {
			ok: false,
			message: wrongPassword
				? await recordWrongPassword(email)
				: (error?.message ?? "Unable to sign in right now. Please try again."),
		};
	}

	// Right password: the streak is over.
	await clearWrongPasswords(email);

	const [{ data: profile }, { data: roleRow }, { data: claimsData }] = await Promise.all([
		supabase.from("profiles").select("is_active").eq("id", data.user.id).maybeSingle(),
		supabase.from("user_roles").select("role").eq("user_id", data.user.id).maybeSingle(),
		supabase.auth.getClaims(),
	]);

	if (profile && !profile.is_active) {
		await supabase.auth.signOut({ scope: "local" });
		return {
			ok: false,
			message: "Your account has been deactivated. Ask your MD or GM to restore your access.",
		};
	}

	const roleValue = roleRow?.role ?? data.user.app_metadata?.role;
	if (!isAppRole(roleValue)) {
		await supabase.auth.signOut({ scope: "local" });
		return {
			ok: false,
			message:
				"Your account does not have a role assigned yet. Ask your MD or GM to set up your access in Team & access.",
		};
	}

	const claims = claimsData?.claims;
	const sessionId = typeof claims?.session_id === "string" ? claims.session_id : undefined;

	// Lifetime: cookies follow the choice; Supabase Auth ends the session at not_after.
	cookieStore.set(REMEMBER_COOKIE, remember ? "1" : "0", rememberCookieOptions(remember, secure));
	if (sessionId) {
		const { idleHours } = await getSignInPolicy();
		const { error: expiryError } = await admin.rpc("set_session_expiry", {
			p_session_id: sessionId,
			p_user_id: data.user.id,
			p_seconds: sessionLifetimeSeconds(remember, idleHours),
		});
		// Not fatal: without it the proxy still ends the session after the short lifetime.
		if (expiryError) console.error("set_session_expiry failed", expiryError.message);
	}

	const state = await sessionState(supabase, {
		aal: typeof claims?.aal === "string" ? claims.aal : undefined,
		deviceToken: cookieStore.get(TRUSTED_DEVICE_COOKIE)?.value,
	});
	return {
		ok: true,
		requiresMfa: state.owed,
		methods: { app: state.hasApp, email: state.hasEmail },
	};
}

/** The second sign-in step, with the app or an emailed code. */
export async function verifyCode(input: {
	method: VerifyMethod;
	code: string;
	trustDevice: boolean;
}): Promise<AuthResult> {
	return input.method === "app"
		? verifyAppCode(input.code, input.trustDevice)
		: verifyEmailCode(input.code, input.trustDevice);
}

export async function sendVerificationCode(): Promise<AuthResult> {
	return sendEmailCode();
}

/** Emails a reset link. Says the same thing whether or not the email has an account. */
export async function requestPasswordReset(rawEmail: string): Promise<AuthResult> {
	const email = z.string().trim().toLowerCase().email().safeParse(rawEmail);
	if (!email.success) return { ok: false, message: "Enter a valid work email." };

	// A locked account is unlocked by the MD or GM, not by a reset link.
	if (await isAccountLocked(email.data)) return { ok: false, message: ACCOUNT_LOCKED_MESSAGE };

	// Emailed by the app; succeeds quietly for emails with no account
	return sendPasswordReset(email.data);
}

/**
 * Sets a new password from the reset link's session. The link proved the person
 * has the email, so a 5-minute pause is cleared (an account lock
 * is not: only the MD or GM can lift that), trusted
 * browsers are forgotten, and every session (this one too) is signed out.
 */
export async function resetPassword(input: { password: string }): Promise<AuthResult> {
	const supabase = await createClient();
	const [
		{
			data: { user },
		},
		{ data: claimsData },
	] = await Promise.all([supabase.auth.getUser(), supabase.auth.getClaims()]);

	// Only a session opened by a reset or invite link in the last hour may set a
	// password this way (an ordinary session changes it in Security settings).
	const amr = Array.isArray(claimsData?.claims.amr) ? claimsData.claims.amr : [];
	const fromLink = amr.some((entry) => {
		const { method, timestamp } = entry as { method?: string; timestamp?: number };
		return (
			(method === "recovery" || method === "invite" || method === "otp") &&
			typeof timestamp === "number" &&
			Date.now() / 1000 - timestamp < 60 * 60
		);
	});
	if (!user?.email || !fromLink) {
		return { ok: false, message: "This reset link has expired. Request a new one." };
	}

	if (await isAccountLocked(user.email)) return { ok: false, message: ACCOUNT_LOCKED_MESSAGE };

	const problem = passwordProblem(input.password ?? "", user.email);
	if (problem) return { ok: false, message: problem };

	const admin = createAdminClient();
	const { error } = await admin.auth.admin.updateUserById(user.id, {
		password: input.password,
	});
	if (error) return { ok: false, message: error.message };

	await Promise.all([clearWrongPasswords(user.email), forgetTrustedDevices(user.id, false)]);
	await supabase.auth.signOut({ scope: "global" });
	return { ok: true };
}

/** Ends this session in Supabase Auth and deletes its cookies. */
export async function signOut(): Promise<AuthResult> {
	const supabase = await createClient();
	const { error } = await supabase.auth.signOut({ scope: "local" });
	if (error) return { ok: false, message: error.message };
	return { ok: true };
}

/**
 * First password for an invited person (they signed in from the invite link and
 * have no password yet). Must meet the stronger rules. Email codes are already
 * on as their two-step; the invite link counted as passing one for this session.
 */
export async function finishAccountSetup(input: { password: string }): Promise<AuthResult> {
	const session = await currentSession();
	if (!session) return { ok: false, message: "Your invite session ended. Open the link again." };
	if (!session.needsPassword) {
		return { ok: false, message: "Your password is already set. Change it in Settings." };
	}

	const problem = passwordProblem(input.password ?? "", session.email);
	if (problem) return { ok: false, message: problem };

	// Through their own session, so this session stays signed in
	const { error } = await session.supabase.auth.updateUser({ password: input.password });
	if (error) return { ok: false, message: error.message };

	await finishInvite(session.user.id);
	await session.supabase.from("audit_logs").insert({
		actor_id: session.user.id,
		action: "user.invite_accepted",
		entity_type: "profile",
		entity_id: session.user.id,
	});
	return { ok: true };
}
