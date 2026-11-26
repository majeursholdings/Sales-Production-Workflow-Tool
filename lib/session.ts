import { cache } from "react";
import { redirect } from "next/navigation";
import {
	ROLE_LABELS,
	canAccessRoute,
	hasPermission,
	isAppRole,
	isOwnerAppRole,
	type AppPermission,
	type AppRole,
} from "@/lib/roles";
import { cookies } from "next/headers";
import { TRUSTED_DEVICE_COOKIE, sessionExpiresAt } from "@/lib/sessionPolicy";
import { sessionState } from "@/lib/twoStep";
import { createClient } from "@/utils/supabase/server";

export type SessionUser = {
	id: string;
	email: string;
	name: string;
	phone: string;
	/** Canonical database role enum key (e.g. "md", "accounting"). */
	roleKey: AppRole;
	/** Human-readable role label (drives nav & dashboard helpers). */
	role: string;
	isActive: boolean;
	/** Unlocked after a 5-failure lockout; user must complete review on /settings/security. */
	lockoutReview: boolean;
	unreadNotificationsCount: number;
};

/**
 * Loads the server-verified Supabase user, profile, and assigned role.
 * Verifies the JWT signature via `getClaims()` and checks live session,
 * active account, MFA, profile, and role in one `session_state` RPC.
 * Memoized per request with React `cache()` so multiple Server Components
 * in the same render pass share one lookup.
 */
export const getOptionalUser = cache(async (): Promise<SessionUser | null> => {
	const supabase = await createClient();
	const [{ data: claimsData, error }, cookieStore] = await Promise.all([
		supabase.auth.getClaims(),
		cookies(),
	]);

	const claims = claimsData?.claims;
	const userId = typeof claims?.sub === "string" ? claims.sub : null;
	if (error || !claims || !userId) {
		return null;
	}

	const expiresAt = sessionExpiresAt(claims);
	if (expiresAt !== null && Date.now() / 1000 >= expiresAt) {
		redirect("/login?error=session_expired");
	}

	// Single database round-trip: live session, active account, MFA, profile and role.
	const state = await sessionState(supabase, {
		aal: typeof claims.aal === "string" ? claims.aal : undefined,
		deviceToken: cookieStore.get(TRUSTED_DEVICE_COOKIE)?.value,
	});
	if (state.accountLocked) {
		redirect("/login?error=locked");
	}
	if (!state.live) {
		redirect("/login?error=session_expired");
	}
	if (!state.active) {
		redirect("/login?error=deactivated");
	}
	if (state.owed) {
		redirect("/verify");
	}
	if (state.needsPassword) {
		redirect("/welcome");
	}

	let profileName = state.profile.fullName;
	let profileEmail = state.profile.email;
	let profilePhone = state.profile.phone;
	let dbRole: unknown = state.role;

	// Backwards-compatible fallback when running against a database before
	// the consolidated session_state migration has been applied.
	if (!state.hasProfileFields) {
		const [{ data: profile }, { data: roleRow }] = await Promise.all([
			supabase
				.from("profiles")
				.select("full_name, email, phone, is_active")
				.eq("id", userId)
				.maybeSingle(),
			supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
		]);
		if (profile && !profile.is_active) {
			redirect("/login?error=deactivated");
		}
		profileName = profile?.full_name ?? null;
		profileEmail = profile?.email ?? null;
		profilePhone = profile?.phone ?? null;
		dbRole = roleRow?.role ?? null;
	}

	// Only trust database user_roles or admin-only app_metadata (never user_metadata).
	const appMetadata =
		typeof claims.app_metadata === "object" && claims.app_metadata !== null
			? (claims.app_metadata as Record<string, unknown>)
			: undefined;
	const userMetadata =
		typeof claims.user_metadata === "object" && claims.user_metadata !== null
			? (claims.user_metadata as Record<string, unknown>)
			: undefined;
	const claimEmail = typeof claims.email === "string" ? claims.email : "";

	const rawRole = dbRole ?? appMetadata?.role;
	if (!isAppRole(rawRole)) {
		redirect("/login?error=no_role");
	}

	const fallbackName =
		(typeof userMetadata?.full_name === "string" && userMetadata.full_name.trim()) ||
		claimEmail.split("@")[0] ||
		"Staff Member";

	return {
		id: userId,
		email: profileEmail || claimEmail,
		name: profileName || fallbackName,
		phone: profilePhone || "",
		roleKey: rawRole,
		role: ROLE_LABELS[rawRole],
		isActive: state.active,
		lockoutReview: state.lockoutReview,
		unreadNotificationsCount: 0,
	};
});

/**
 * Require a signed-in, active user with an assigned role.
 * Redirects to /login if unauthenticated, /welcome if invite password setup is pending,
 * and /settings/security if a post-lockout security review is pending (unless opted out
 * by the security settings layout/page itself).
 */
export async function getCurrentUser(options?: {
	allowLockoutReview?: boolean;
}): Promise<SessionUser> {
	const user = await getOptionalUser();
	if (!user) {
		redirect("/login");
	}
	if (!options?.allowLockoutReview && user.lockoutReview) {
		redirect("/settings/security");
	}
	return user;
}

/** Alias for semantic clarity in server actions and protected pages. */
export const requireUser = getCurrentUser;

/** Require the current user to hold one of the specified roles. */
export async function requireRole(allowedRoles: readonly AppRole[]): Promise<SessionUser> {
	const user = await getCurrentUser();
	if (!allowedRoles.includes(user.roleKey)) {
		redirect("/unauthorized");
	}
	return user;
}

/** Require the current user's role to grant a specific capability permission. */
export async function requirePermission(permission: AppPermission): Promise<SessionUser> {
	const user = await getCurrentUser();
	if (!hasPermission(user.roleKey, permission)) {
		redirect("/unauthorized");
	}
	return user;
}

/** Require MD or GM (superadmin) role. */
export async function requireOwner(): Promise<SessionUser> {
	const user = await getCurrentUser();
	if (!isOwnerAppRole(user.roleKey)) {
		redirect("/unauthorized");
	}
	return user;
}

/** Require the current user's role to have access to the given route prefix (single source of truth in lib/roles.ts). */
export async function requireRouteAccess(pathname: string): Promise<SessionUser> {
	const user = await getCurrentUser();
	if (!canAccessRoute(user.roleKey, pathname)) {
		redirect("/unauthorized");
	}
	return user;
}
