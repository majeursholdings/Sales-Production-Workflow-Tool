/**
 * Server-only Supabase settings. The browser never gets a Supabase key: every
 * call goes through this app's server, so nobody can call Supabase Auth or the
 * database directly. (The keys must not be prefixed NEXT_PUBLIC_.)
 */

function required(name: string, value: string | undefined): string {
	if (!value) throw new Error(`Missing ${name} in the server environment.`);
	return value;
}

function assertServer() {
	if (typeof window !== "undefined") {
		throw new Error("Supabase keys are server-only.");
	}
}

export function supabaseUrl(): string {
	assertServer();
	return required(
		"SUPABASE_URL",
		process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
	);
}

export function publishableKey(): string {
	assertServer();
	return required("SUPABASE_PUBLISHABLE_KEY", process.env.SUPABASE_PUBLISHABLE_KEY);
}

export function secretKey(): string | undefined {
	assertServer();
	return process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
}

/**
 * The visitor's IP, as set by the hosting platform (Vercel overwrites these
 * headers, so a browser can't fake them). Null when there's no proxy in front.
 */
export function clientIp(headers: Headers): string | null {
	const real = headers.get("x-real-ip")?.trim();
	if (real) return real;
	const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
	return forwarded || null;
}

/**
 * fetch for Supabase clients made on the server. Supabase Auth rate-limits per
 * IP, and every call now comes from this server, so Auth calls carry the
 * visitor's IP in `Sb-Forwarded-For`. Supabase only honours that header with the
 * secret key, so Auth calls are sent with it. A person's session token, when
 * present, still decides who the call acts as. Database calls are unchanged.
 *
 * Needs "Sb-Forwarded-For" turned on in Supabase → Authentication → Rate Limits;
 * until then Auth falls back to limiting by this server's IP.
 */
export function authFetch(ip: string | null): typeof fetch {
	const secret = secretKey();
	const publishable = publishableKey();
	const authBase = `${supabaseUrl()}/auth/v1/`;

	return (input, init) => {
		const url =
			typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
		if (!secret || !url.startsWith(authBase)) return fetch(input, init);

		const headers = new Headers(
			init?.headers ?? (input instanceof Request ? input.headers : undefined),
		);
		headers.set("apikey", secret);
		// No session: the client sends its key as the bearer; swap that too.
		if (headers.get("authorization") === `Bearer ${publishable}`) {
			headers.set("authorization", `Bearer ${secret}`);
		}
		if (ip) headers.set("sb-forwarded-for", ip);
		return fetch(input, { ...init, headers });
	};
}
