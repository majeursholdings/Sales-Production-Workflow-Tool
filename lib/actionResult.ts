import type { AppPermission } from "@/lib/roles";
import { hasPermission } from "@/lib/roles";
import { getCurrentUser, type SessionUser } from "@/lib/session";

export type ActionResult<T = undefined> =
	(T extends undefined ? { ok: true } : { ok: true; data: T }) | { ok: false; message: string };

export const fail = (message: string) => ({ ok: false as const, message });

/** The signed-in user when their role grants `permission`, otherwise null. */
export async function userWith(permission: AppPermission): Promise<SessionUser | null> {
	const user = await getCurrentUser();
	return hasPermission(user.roleKey, permission) ? user : null;
}
