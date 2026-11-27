import { z } from "zod";
import { currentSession } from "@/lib/currentSession";
import { clearWrongPasswords, lockMessage, recordWrongPassword } from "@/lib/loginLock";
import { createThrowawayClient } from "@/utils/supabase/server";

/**
 * Step-up check for sensitive changes (e.g. AI provider keys): the signed-in
 * person proves it's them again with their password and a fresh two-step code,
 * even on a trusted browser. Called from server actions only.
 */

export const stepUpSchema = z.object({
	password: z.string().min(1, "Enter your password."),
	code: z
		.string()
		.trim()
		.regex(/^\d{6}$/, "Enter the 6-digit code."),
	method: z.enum(["app", "email"]),
});

export type StepUpProof = z.input<typeof stepUpSchema>;

export type StepUpResult = { ok: true; userId: string } | { ok: false; message: string };

export async function confirmIdentity(raw: StepUpProof): Promise<StepUpResult> {
	const parsed = stepUpSchema.safeParse(raw);
	if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
	const { password, code, method } = parsed.data;

	const session = await currentSession();
	if (!session) return { ok: false, message: "Your session expired. Sign in again." };
	if (session.owed) return { ok: false, message: "Finish signing in first." };
	if (!session.hasApp && !session.hasEmail) {
		return {
			ok: false,
			message:
				"Turn on two-step verification in Settings › Security first. This change needs a code.",
		};
	}
	if (method === "app" && !session.hasApp) {
		return { ok: false, message: "No authenticator app is set up. Use an emailed code." };
	}
	if (method === "email" && !session.hasEmail) {
		return { ok: false, message: "Email codes aren't on for your account. Use your app." };
	}
	const email = session.email.toLowerCase();

	// Password, on a throwaway client so this session isn't replaced
	const locked = await lockMessage(email);
	if (locked) return { ok: false, message: locked };
	const checker = await createThrowawayClient();
	const { error: passwordError } = await checker.auth.signInWithPassword({ email, password });
	if (passwordError) {
		if (passwordError.code === "invalid_credentials") {
			const next = await recordWrongPassword(email);
			return {
				ok: false,
				message: next.startsWith("Too many") ? next : "Your password isn't right.",
			};
		}
		return { ok: false, message: "Couldn't check your password. Try again." };
	}
	await checker.auth.signOut({ scope: "local" });
	await clearWrongPasswords(email);

	// A fresh code
	if (method === "app") {
		const { data: factors, error } = await session.supabase.auth.mfa.listFactors();
		const factor = factors?.totp.find((f) => f.status === "verified");
		if (error || !factor) {
			return { ok: false, message: "No authenticator app is set up for this account." };
		}
		const { error: codeError } = await session.supabase.auth.mfa.challengeAndVerify({
			factorId: factor.id,
			code,
		});
		if (codeError) {
			return {
				ok: false,
				message:
					"That code didn't work. Codes change every 30 seconds, so use the newest one.",
			};
		}
	} else {
		const client = await createThrowawayClient();
		const { data, error } = await client.auth.verifyOtp({ email, token: code, type: "email" });
		if (error || !data.session) {
			return { ok: false, message: "That code is invalid or expired. Send a new one." };
		}
		await client.auth.signOut({ scope: "local" });
	}

	return { ok: true, userId: session.user.id };
}
