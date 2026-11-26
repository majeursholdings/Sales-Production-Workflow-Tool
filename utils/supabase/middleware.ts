import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { canAccessRoute, isAppRole } from "@/lib/roles";
import {
	REMEMBER_COOKIE,
	TRUSTED_DEVICE_COOKIE,
	isAuthCookie,
	isRemembered,
	secureCookiesFor,
	sessionExpiresAt,
	withSessionLifetime,
} from "@/lib/sessionPolicy";
import { sessionState } from "@/lib/twoStep";
import { authFetch, clientIp, publishableKey, supabaseUrl } from "@/utils/supabase/env";

const PUBLIC_PATHS = ["/login", "/forgot-password", "/auth/confirm", "/auth/invite"];
const CACHE_HEADERS = ["cache-control", "expires", "pragma"] as const;

/** Login errors that mean the person must not stay signed in. */
const SIGN_OUT_ERRORS = new Set(["deactivated", "no_role", "session_expired", "locked"]);

function isPublicPath(pathname: string): boolean {
	return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/** Deletes every Supabase session cookie the browser sent (bad, expired, or ended sessions). */
function clearAuthCookies(request: NextRequest, response: NextResponse): NextResponse {
	for (const { name } of request.cookies.getAll()) {
		if (isAuthCookie(name)) response.cookies.set(name, "", { path: "/", maxAge: 0 });
	}
	return response;
}

function redirectWithCookies(url: URL, supabaseResponse: NextResponse): NextResponse {
	const redirectResponse = NextResponse.redirect(url);
	supabaseResponse.cookies.getAll().forEach((cookie) => {
		redirectResponse.cookies.set(cookie);
	});
	for (const header of CACHE_HEADERS) {
		const value = supabaseResponse.headers.get(header);
		if (value) redirectResponse.headers.set(header, value);
	}
	return redirectResponse;
}

export async function updateSession(request: NextRequest) {
	let supabaseResponse = NextResponse.next({
		request,
	});
	const remember = isRemembered(request.cookies.get(REMEMBER_COOKIE)?.value);
	const secure = secureCookiesFor(
		request.nextUrl.protocol === "https:" ||
			request.headers.get("x-forwarded-proto") === "https",
	);

	const supabase = createServerClient(supabaseUrl(), publishableKey(), {
		global: { fetch: authFetch(clientIp(request.headers)) },
		cookies: {
			getAll() {
				return request.cookies.getAll();
			},
			setAll(cookiesToSet, headers) {
				cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
				supabaseResponse = NextResponse.next({
					request,
				});
				cookiesToSet.forEach(({ name, value, options }) =>
					supabaseResponse.cookies.set(
						name,
						value,
						withSessionLifetime(options, { remember, secure }),
					),
				);
				Object.entries(headers).forEach(([key, value]) =>
					supabaseResponse.headers.set(key, value),
				);
			},
		},
	});

	// Always verify the JWT signature via getClaims() rather than trusting raw session cookies.
	const { data } = await supabase.auth.getClaims();
	const claims = data?.claims;
	const { pathname } = request.nextUrl;
	const isPublic = isPublicPath(pathname);
	const isVerify = pathname === "/verify";

	// No valid session. Any session cookie left is invalid (tampered, revoked, or
	// expired), so delete it rather than re-checking it on every request.
	if (!claims) {
		if (!isPublic) {
			const loginUrl = request.nextUrl.clone();
			loginUrl.pathname = "/login";
			loginUrl.search = "";
			if (pathname !== "/" && !isVerify) {
				loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
			}
			return clearAuthCookies(request, redirectWithCookies(loginUrl, supabaseResponse));
		}
		return clearAuthCookies(request, supabaseResponse);
	}

	/** Ends this session (server side too) and sends the person to /login with a reason. */
	const endSession = async (reason: string) => {
		await supabase.auth.signOut({ scope: "local" });
		const loginUrl = request.nextUrl.clone();
		loginUrl.pathname = "/login";
		loginUrl.search = `?error=${reason}`;
		return clearAuthCookies(request, redirectWithCookies(loginUrl, supabaseResponse));
	};

	// Server Components can't clear cookies, so when they send someone to /login
	// for a reason that ends the session (no role, deactivated), sign out here.
	const loginError = request.nextUrl.searchParams.get("error");
	if (pathname === "/login" && loginError && SIGN_OUT_ERRORS.has(loginError)) {
		await supabase.auth.signOut({ scope: "local" });
		return clearAuthCookies(request, supabaseResponse);
	}

	// A token issued before its session got an end time still gets the short lifetime.
	const expiresAt = sessionExpiresAt(claims);
	if (expiresAt !== null && Date.now() / 1000 >= expiresAt) {
		return endSession("session_expired");
	}

	// Checked on every request, so a signed-out, revoked or expired session, or a
	// deactivated or deleted account, stops working straight away rather than when
	// its access token runs out. Fails closed if the check itself fails.
	let state;
	try {
		state = await sessionState(supabase, {
			aal: typeof claims.aal === "string" ? claims.aal : undefined,
			deviceToken: request.cookies.get(TRUSTED_DEVICE_COOKIE)?.value,
		});
	} catch (error) {
		console.error(error);
		return new NextResponse("Sign-in check is unavailable. Try again in a moment.", {
			status: 503,
			headers: { "retry-after": "30" },
		});
	}

	if (state.accountLocked) return endSession("locked");
	if (!state.live) return endSession("session_expired");
	if (!state.active || claims.user_active === false) return endSession("deactivated");

	const needsMfa = state.owed;

	if (needsMfa && !isVerify && !isPublic) {
		const verifyUrl = request.nextUrl.clone();
		verifyUrl.pathname = "/verify";
		verifyUrl.search = "";
		return redirectWithCookies(verifyUrl, supabaseResponse);
	}

	if (!needsMfa && isVerify) {
		const homeUrl = request.nextUrl.clone();
		homeUrl.pathname = "/";
		homeUrl.search = "";
		return redirectWithCookies(homeUrl, supabaseResponse);
	}

	// Invited and signed in from the link, but no password yet: finish setting up first.
	if (state.needsPassword && !needsMfa && !isPublic && pathname !== "/welcome") {
		const welcomeUrl = request.nextUrl.clone();
		welcomeUrl.pathname = "/welcome";
		welcomeUrl.search = "";
		return redirectWithCookies(welcomeUrl, supabaseResponse);
	}

	// Just unlocked after a lockout: keep the person on Security settings until
	// they say whether it was them (and, if not, change their password).
	const reviewPath = "/settings/security";
	if (
		state.lockoutReview &&
		!needsMfa &&
		!isPublic &&
		pathname !== reviewPath &&
		!pathname.startsWith(`${reviewPath}/`)
	) {
		const reviewUrl = request.nextUrl.clone();
		reviewUrl.pathname = reviewPath;
		reviewUrl.search = "";
		return redirectWithCookies(reviewUrl, supabaseResponse);
	}

	// Redirect already-signed-in users away from /login (unless displaying an error banner).
	if (pathname === "/login" && !request.nextUrl.searchParams.has("error")) {
		const targetUrl = request.nextUrl.clone();
		targetUrl.pathname = needsMfa ? "/verify" : "/";
		targetUrl.search = "";
		return redirectWithCookies(targetUrl, supabaseResponse);
	}

	// Fast role guard using the verified JWT custom claim (also re-verified in Server Components).
	if (
		!isPublic &&
		!isVerify &&
		isAppRole(claims.user_role) &&
		!canAccessRoute(claims.user_role, pathname)
	) {
		const deniedUrl = request.nextUrl.clone();
		deniedUrl.pathname = "/unauthorized";
		deniedUrl.search = "";
		return redirectWithCookies(deniedUrl, supabaseResponse);
	}

	return supabaseResponse;
}

/** Backwards-compatible alias. */
export const createClient = updateSession;
