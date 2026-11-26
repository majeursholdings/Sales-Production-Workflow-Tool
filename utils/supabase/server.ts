import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { io } from "next/cache";
import { cookies, headers } from "next/headers";
import {
	REMEMBER_COOKIE,
	isRemembered,
	secureCookiesFor,
	withSessionLifetime,
} from "@/lib/sessionPolicy";
import { authFetch, clientIp, publishableKey, supabaseUrl } from "@/utils/supabase/env";

/** Whether the current request came over HTTPS, and the visitor's IP. */
export async function requestInfo() {
	const headerStore = await headers();
	return {
		secure: secureCookiesFor(headerStore.get("x-forwarded-proto") === "https"),
		ip: clientIp(headerStore),
		origin: `${headerStore.get("x-forwarded-proto") ?? "http"}://${headerStore.get("x-forwarded-host") ?? headerStore.get("host")}`,
	};
}

/**
 * Supabase client acting as the signed-in person, from their (HttpOnly) cookies.
 * `remember` overrides the stored "Keep me signed in" choice (used while signing in).
 */
export async function createClient(options: { remember?: boolean } = {}) {
	// `@supabase/ssr` / `@supabase/auth-js` reads `Date.now()` while validating
	// sessions. With Next.js Cache Components enabled, `cookies()` resolves during
	// runtime prerendering, so defer via `io()` first to enter the dynamic stage.
	await io();
	const [cookieStore, { secure, ip }] = await Promise.all([cookies(), requestInfo()]);

	return createServerClient(supabaseUrl(), publishableKey(), {
		global: { fetch: authFetch(ip) },
		cookies: {
			getAll() {
				return cookieStore.getAll();
			},
			setAll(cookiesToSet) {
				const remember =
					options.remember ?? isRemembered(cookieStore.get(REMEMBER_COOKIE)?.value);
				try {
					cookiesToSet.forEach(({ name, value, options: cookieOptions }) =>
						cookieStore.set(
							name,
							value,
							withSessionLifetime(cookieOptions, { remember, secure }),
						),
					);
				} catch {
					// Called from a Server Component where setting cookies is not allowed.
					// Session refresh is handled by proxy.ts on every request.
				}
			},
		},
	});
}

/**
 * A Supabase client with no stored session, for checking a password or an email
 * code without replacing the session the person is signed in with.
 */
export async function createThrowawayClient() {
	const { ip } = await requestInfo();
	return createSupabaseClient(supabaseUrl(), publishableKey(), {
		auth: { persistSession: false, autoRefreshToken: false },
		global: { fetch: authFetch(ip) },
	});
}
