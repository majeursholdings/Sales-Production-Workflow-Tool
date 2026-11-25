import { sendEmailCode, verifyEmailCode } from "@/lib/emailTwoStepActions";
import { isAppRole } from "@/lib/roles";
import { secondStepOwed } from "@/lib/twoStep";
import { createClient } from "@/utils/supabase/client";

export type AuthResult = { ok: true } | { ok: false; message: string };
/** Which second-step methods the person has set up. */
export type TwoStepMethods = { app: boolean; email: boolean };

export type SignInResult =
	{ ok: true; requiresMfa: boolean; methods: TwoStepMethods } | { ok: false; message: string };

export type VerifyMethod = "app" | "email" | "backup";

export async function signIn(input: {
	email: string;
	password: string;
	remember: boolean;
}): Promise<SignInResult> {
	const supabase = createClient();

	const { data, error } = await supabase.auth.signInWithPassword({
		email: input.email.trim(),
		password: input.password,
	});

	if (error || !data.user) {
		return {
			ok: false,
			message:
				error?.message === "Invalid login credentials"
					? "Incorrect email or password. Try again or reset your password."
					: (error?.message ?? "Unable to sign in right now. Please try again."),
		};
	}

	const [{ data: profile }, { data: roleRow }, { data: aal }] = await Promise.all([
		supabase.from("profiles").select("is_active").eq("id", data.user.id).maybeSingle(),
		supabase.from("user_roles").select("role").eq("user_id", data.user.id).maybeSingle(),
		supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
	]);

	if (profile && !profile.is_active) {
		await supabase.auth.signOut();
		return {
			ok: false,
			message: "Your account has been deactivated. Ask your MD or GM to restore your access.",
		};
	}

	const roleValue = roleRow?.role ?? data.user.app_metadata?.role;
	if (!isAppRole(roleValue)) {
		await supabase.auth.signOut();
		return {
			ok: false,
			message:
				"Your account does not have a role assigned yet. Ask your MD or GM to set up your access in Team & access.",
		};
	}

	const { data: claimsData } = await supabase.auth.getClaims();
	const sessionId = claimsData?.claims.session_id;
	const state = await secondStepOwed(supabase, {
		userId: data.user.id,
		sessionId: typeof sessionId === "string" ? sessionId : undefined,
		aal: aal?.currentLevel ?? undefined,
		hasApp: aal?.nextLevel === "aal2",
	});
	return {
		ok: true,
		requiresMfa: state.owed,
		methods: { app: state.hasApp, email: state.hasEmail },
	};
}

export async function verifyCode(input: {
	method: VerifyMethod;
	code: string;
	trustDevice: boolean;
}): Promise<AuthResult> {
	const supabase = createClient();
	const trimmedCode = input.code.trim();

	if (input.method === "app") {
		const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
		if (listError) {
			return { ok: false, message: listError.message };
		}

		const totpFactor = factors?.totp.find((factor) => factor.status === "verified");
		if (!totpFactor) {
			return {
				ok: false,
				message: "No authenticator app is set up for this account.",
			};
		}

		const { error } = await supabase.auth.mfa.challengeAndVerify({
			factorId: totpFactor.id,
			code: trimmedCode,
		});

		if (error) {
			return { ok: false, message: "That code didn't work. Check your app and try again." };
		}

		return { ok: true };
	}

	if (input.method === "email") {
		// Checked on the server, which records that this session passed (see lib/twoStep.ts)
		return verifyEmailCode(trimmedCode);
	}

	return {
		ok: false,
		message:
			"Backup codes are not configured for this workspace. Use your authenticator app or ask your MD or GM to reset two-step verification.",
	};
}

export async function sendVerificationCode(_method: "email"): Promise<AuthResult> {
	void _method;
	return sendEmailCode();
}

export async function requestPasswordReset(email: string): Promise<AuthResult> {
	const supabase = createClient();
	const origin = typeof window !== "undefined" ? window.location.origin : "";
	const redirectTo = origin
		? `${origin}/auth/confirm?next=${encodeURIComponent("/forgot-password?mode=reset")}`
		: undefined;

	const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
	if (error) {
		return { ok: false, message: error.message };
	}

	return { ok: true };
}

export async function resetPassword(input: {
	token?: string;
	password: string;
}): Promise<AuthResult> {
	const supabase = createClient();

	const { error } = await supabase.auth.updateUser({
		password: input.password,
	});

	if (error) {
		return { ok: false, message: error.message };
	}

	// Sign out other active devices after a password change.
	await supabase.auth.signOut({ scope: "others" });
	return { ok: true };
}

export async function signOut(): Promise<AuthResult> {
	const supabase = createClient();
	const { error } = await supabase.auth.signOut();
	if (error) {
		return { ok: false, message: error.message };
	}
	return { ok: true };
}
