import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { TRUSTED_DEVICE_COOKIE } from "@/lib/sessionPolicy";
import { createAdminClient } from "@/utils/supabase/admin";

/**
 * Server-only helpers for trusted browsers. Deliberately not a "use server"
 * file: these take a user id, so they must never be callable from the browser.
 */

/** Hash stored for a trusted-device token (matches session_state's sha256 check). */
export function tokenHash(token: string): string {
	return createHash("sha256").update(token).digest("hex");
}

/** Forgets trusted browsers for this person (all, or all but the current one). */
export async function forgetTrustedDevices(userId: string, keepCurrent: boolean) {
	const admin = createAdminClient();
	const current = keepCurrent ? (await cookies()).get(TRUSTED_DEVICE_COOKIE)?.value : undefined;
	let query = admin.from("trusted_devices").delete().eq("user_id", userId);
	if (current) query = query.neq("token_hash", tokenHash(current));
	await query;
}
