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
import { TRUSTED_DEVICE_COOKIE } from "@/lib/sessionPolicy";
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
	unreadNotificationsCount: number;
};

/**
 * Loads the server-verified Supabase user, profile, and assigned role.
 * Memoized per request with React `cache()` so multiple Server Components
 * in the same render pass share one lookup.
 */
export const getOptionalUser = cache(async (): Promise<SessionUser | null> => {
	const supabase = await createClient();
	const {
		data: { user },
		error,
	} = await supabase.auth.getUser();

	if (error || !user) {
		return null;
	}

	// Server-side checks: live session, active account, second step passed.
	const [{ data: claimsData }, cookieStore] = await Promise.all([
		supabase.auth.getClaims(),
		cookies(),
	]);
	const claims = claimsData?.claims;
	const state = await sessionState(supabase, {
		aal: typeof claims?.aal === "string" ? claims.aal : undefined,
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

	const [{ data: profile }, { data: roleRow }] = await Promise.all([
		supabase
			.from("profiles")
			.select("full_name, email, phone, is_active")
			.eq("id", user.id)
			.maybeSingle(),
		supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
	]);

	if (profile && !profile.is_active) {
		redirect("/login?error=deactivated");
	}

	// Only trust database user_roles or admin-only app_metadata (never user_metadata).
	const rawRole = roleRow?.role ?? user.app_metadata?.role;
	if (!isAppRole(rawRole)) {
		redirect("/login?error=no_role");
	}

	const fallbackName =
		(typeof user.user_metadata?.full_name === "string" &&
			user.user_metadata.full_name.trim()) ||
		user.email?.split("@")[0] ||
		"Staff Member";

	return {
		id: user.id,
		email: profile?.email || user.email || "",
		name: profile?.full_name || fallbackName,
		phone: profile?.phone || "",
		roleKey: rawRole,
		role: ROLE_LABELS[rawRole],
		isActive: profile?.is_active ?? true,
		unreadNotificationsCount: 0,
	};
});

/**
 * Require a signed-in, active user with an assigned role.
 * Redirects to /login if unauthenticated.
 */
export async function getCurrentUser(): Promise<SessionUser> {
	const user = await getOptionalUser();
	if (!user) {
		redirect("/login");
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
