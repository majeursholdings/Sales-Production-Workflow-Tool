import { createClient } from "@supabase/supabase-js";

function getSecretKey(): string | undefined {
	return process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
}

export function hasAdminClient(): boolean {
	return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && getSecretKey());
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

	const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const secretKey = getSecretKey();

	if (!url || !secretKey) {
		throw new Error(
			"Missing SUPABASE_SECRET_KEY in server environment. Add your Supabase secret key to .env.local to manage team accounts.",
		);
	}

	return createClient(url, secretKey, {
		auth: {
			autoRefreshToken: false,
			persistSession: false,
		},
	});
}
