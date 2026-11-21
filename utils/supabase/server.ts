import { createServerClient } from "@supabase/ssr";
import { io } from "next/cache";
import { cookies } from "next/headers";

export async function createClient() {
	// `@supabase/ssr` / `@supabase/auth-js` reads `Date.now()` while validating
	// sessions. With Next.js Cache Components enabled, `cookies()` resolves during
	// runtime prerendering, so defer via `io()` first to enter the dynamic stage.
	await io();
	const cookieStore = await cookies();

	return createServerClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
		{
			cookies: {
				getAll() {
					return cookieStore.getAll();
				},
				setAll(cookiesToSet) {
					try {
						cookiesToSet.forEach(({ name, value, options }) =>
							cookieStore.set(name, value, options),
						);
					} catch {
						// Called from a Server Component where setting cookies is not allowed.
						// Session refresh is handled by proxy.ts on every request.
					}
				},
			},
		},
	);
}
