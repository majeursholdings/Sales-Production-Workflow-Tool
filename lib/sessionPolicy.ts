import type { CookieOptions } from "@supabase/ssr";

/**
 * How long a sign-in lasts, and how its cookies are set. Shared by the proxy and
 * the server Supabase client, so every place that writes the auth cookies gives
 * them the same lifetime and flags.
 *
 * - "Keep me signed in": cookies last 30 days; the session ends 30 days after sign-in.
 * - Otherwise: cookies end when the browser closes; the session ends 12 hours
 *   after sign-in even if the browser restores its cookies.
 *
 * All of these cookies are HttpOnly (page scripts can't read them) and Secure
 * (sent over HTTPS only) in production. Only the server ever reads them.
 *
 * The end time is set on the session in Supabase Auth (`not_after`), which stops
 * refreshes; the proxy checks it on every request through session_state().
 */

/** Remembers the "Keep me signed in" choice, so refreshed cookies keep the same lifetime. */
export const REMEMBER_COOKIE = "majeurs-remember";
/** Random token for a browser trusted to skip the second step (hash stored in trusted_devices). */
export const TRUSTED_DEVICE_COOKIE = "majeurs-trusted-device";
export const REMEMBER_SECONDS = 30 * 24 * 60 * 60;
export const TRUSTED_DEVICE_SECONDS = 30 * 24 * 60 * 60;
export const SHORT_SESSION_SECONDS = 12 * 60 * 60;

export function sessionLifetimeSeconds(remember: boolean): number {
	return remember ? REMEMBER_SECONDS : SHORT_SESSION_SECONDS;
}

export function isRemembered(value: string | undefined | null): boolean {
	return value === "1";
}

/**
 * Whether cookies get the Secure flag: always in production (HTTPS only), and in
 * development only when the request came over HTTPS (so http://localhost works).
 */
export function secureCookiesFor(requestIsHttps: boolean): boolean {
	return process.env.NODE_ENV === "production" || requestIsHttps;
}

/**
 * The options for an auth cookie. `@supabase/ssr` always asks for 400 days and
 * a script-readable cookie, so the lifetime and flags are replaced here.
 * Deletions (maxAge 0) keep their maxAge.
 */
export function withSessionLifetime(
	options: CookieOptions,
	{ remember, secure }: { remember: boolean; secure: boolean },
): CookieOptions {
	const flags = { httpOnly: true, secure, sameSite: "lax" as const, path: "/" };
	if (options.maxAge === 0) return { ...options, ...flags };
	const { maxAge: _maxAge, expires: _expires, ...rest } = options;
	void _maxAge;
	void _expires;
	return remember ? { ...rest, ...flags, maxAge: REMEMBER_SECONDS } : { ...rest, ...flags };
}

export function rememberCookieOptions(remember: boolean, secure: boolean): CookieOptions {
	return {
		path: "/",
		sameSite: "lax",
		httpOnly: true,
		secure,
		...(remember ? { maxAge: REMEMBER_SECONDS } : {}),
	};
}

export function trustedDeviceCookieOptions(secure: boolean): CookieOptions {
	return {
		path: "/",
		sameSite: "lax",
		httpOnly: true,
		secure,
		maxAge: TRUSTED_DEVICE_SECONDS,
	};
}

/** Supabase's session cookies (`sb-<ref>-auth-token`, plus its numbered chunks). */
export function isAuthCookie(name: string): boolean {
	return name.startsWith("sb-") && name.includes("-auth-token");
}

/** When the person signed in to this session (unix seconds), from the verified `amr` claim. */
export function signedInAt(claims: Record<string, unknown> | undefined): number | null {
	const amr = Array.isArray(claims?.amr) ? claims.amr : [];
	return amr
		.map((entry) => (entry as { timestamp?: unknown })?.timestamp)
		.filter((t): t is number => typeof t === "number")
		.reduce<number | null>((min, t) => (min === null || t < min ? t : min), null);
}

/**
 * When the session must end, in unix seconds, from verified JWT claims. Uses the
 * `session_expires_at` claim when present; a token issued before it was set (the
 * first hour after sign-in, or sessions from before this rule) gets the short
 * lifetime, counted from when the person signed in.
 */
export function sessionExpiresAt(claims: Record<string, unknown>): number | null {
	if (typeof claims.session_expires_at === "number") return claims.session_expires_at;
	const start = signedInAt(claims);
	return start === null ? null : start + SHORT_SESSION_SECONDS;
}
