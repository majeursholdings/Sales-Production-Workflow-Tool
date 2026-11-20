/* eslint-disable @typescript-eslint/no-unused-vars -- placeholder stubs; the arguments are used once the real backend is wired in */
export type AuthResult = { ok: true } | { ok: false; message: string };

export type VerifyMethod = "app" | "email" | "backup";

/**
 * TODO: replace these placeholders with the real auth backend.
 * The auth pages only talk to auth through here, so wiring it up is a
 * one-file change. Return `{ ok: false, message }` to show an error on the page.
 */
const ok: AuthResult = { ok: true };

export async function signIn(_input: {
	email: string;
	password: string;
	remember: boolean;
}): Promise<AuthResult> {
	return ok;
}

export async function verifyCode(_input: {
	method: VerifyMethod;
	code: string;
	trustDevice: boolean;
}): Promise<AuthResult> {
	return ok;
}

export async function sendVerificationCode(_method: "email"): Promise<AuthResult> {
	return ok;
}

export async function requestPasswordReset(_email: string): Promise<AuthResult> {
	return ok;
}

export async function resetPassword(_input: {
	token: string;
	password: string;
}): Promise<AuthResult> {
	return ok;
}
