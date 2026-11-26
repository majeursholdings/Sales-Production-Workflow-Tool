import { createClient } from "@supabase/supabase-js";
import { secretKey, supabaseUrl } from "@/utils/supabase/env";

export function hasAdminClient(): boolean {
	return Boolean(secretKey());
}

/**
 * Server-only Supabase admin client using the secret / service-role key.
 * NEVER import this in Client Components or expose the key via NEXT_PUBLIC_.
 * Always check authorization (e.g. `requireOwner()`) before calling any admin API.
 */
export function createAdminClient() {
	if (typeof window !== "undefined") {
		throw new Error("createAdminClient must only be called on the server.");
	}

	const url = supabaseUrl();
	const key = secretKey();

	if (!key) {
		throw new Error(
			"Missing SUPABASE_SECRET_KEY in server environment. Add your Supabase secret key to .env.local to manage team accounts.",
		);
	}

	return createClient(url, key, {
		auth: {
			autoRefreshToken: false,
			persistSession: false,
		},
	});
}
