import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { canAccessRoute, isAppRole } from "@/lib/roles";

const PUBLIC_PATHS = ["/login", "/forgot-password", "/auth/confirm"];
const CACHE_HEADERS = ["cache-control", "expires", "pragma"] as const;

function isPublicPath(pathname: string): boolean {
	return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
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

	const supabase = createServerClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
		{
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
						supabaseResponse.cookies.set(name, value, options),
					);
					Object.entries(headers).forEach(([key, value]) =>
						supabaseResponse.headers.set(key, value),
					);
				},
			},
		},
	);

	// Always verify the JWT signature via getClaims() rather than trusting raw session cookies.
	const { data } = await supabase.auth.getClaims();
	const claims = data?.claims;
	const { pathname } = request.nextUrl;
	const isPublic = isPublicPath(pathname);
	const isVerify = pathname === "/verify";

	if (!claims) {
		if (!isPublic) {
			const loginUrl = request.nextUrl.clone();
			loginUrl.pathname = "/login";
			loginUrl.search = "";
			if (pathname !== "/" && !isVerify) {
				loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
			}
			return redirectWithCookies(loginUrl, supabaseResponse);
		}
		return supabaseResponse;
	}

	// Block deactivated users immediately when the Custom Access Token Hook marks user_active=false.
	if (claims.user_active === false && !isPublic) {
		const loginUrl = request.nextUrl.clone();
		loginUrl.pathname = "/login";
		loginUrl.search = "?error=deactivated";
		return redirectWithCookies(loginUrl, supabaseResponse);
	}

	// Enforce MFA only if the user has a verified factor and has not yet completed AAL2.
	let needsMfa = false;
	if (claims.aal === "aal1") {
		const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
		if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
			needsMfa = true;
		}
	}

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

	// Redirect already-authenticated active users away from /login (unless displaying an error banner).
	if (
		pathname === "/login" &&
		claims.user_active !== false &&
		!request.nextUrl.searchParams.has("error")
	) {
		const targetUrl = request.nextUrl.clone();
		targetUrl.pathname = needsMfa ? "/verify" : "/";
		targetUrl.search = "";
		return redirectWithCookies(targetUrl, supabaseResponse);
	}

	// Fast edge role guard using the verified JWT custom claim (also re-verified in Server Components).
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
