import { isAppRole, type AppRole } from "@/lib/roles";
import { requireOwner } from "@/lib/session";
import { createAdminClient, hasAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";

export type TeamMember = {
	id: string;
	/** First name and surname written out. */
	fullName: string;
	title: string;
	firstName: string;
	surname: string;
	email: string;
	phone: string;
	role: AppRole | null;
	isActive: boolean;
	/** Locked after 5 wrong passwords: only an MD or GM can unlock it. */
	locked: boolean;
	/** Invited and hasn't set a password yet. */
	invitePending: boolean;
	createdAt: string;
};

/** People who haven't accepted their invite yet (pending_invites is service-role only). */
async function pendingInviteIds(): Promise<Set<string>> {
	if (!hasAdminClient()) return new Set();
	const { data } = await createAdminClient().from("pending_invites").select("user_id");
	return new Set((data ?? []).map((row) => row.user_id));
}

/** Emails whose accounts are locked (login_attempts is service-role only). */
async function lockedEmails(): Promise<Set<string>> {
	if (!hasAdminClient()) return new Set();
	const { data } = await createAdminClient()
		.from("login_attempts")
		.select("email")
		.not("account_locked_at", "is", null);
	return new Set((data ?? []).map((row) => row.email));
}

export async function getTeamMembers(): Promise<TeamMember[]> {
	await requireOwner();
	const supabase = await createClient();

	const [
		{ data: profiles, error: profilesError },
		{ data: roles, error: rolesError },
		locked,
		invited,
	] = await Promise.all([
		supabase
			.from("profiles")
			.select(
				"id, full_name, title, first_name, surname, email, phone, is_active, created_at",
			)
			.order("created_at", { ascending: true }),
		supabase.from("user_roles").select("user_id, role"),
		lockedEmails(),
		pendingInviteIds(),
	]);

	if (profilesError) {
		throw new Error(`Failed to load team profiles: ${profilesError.message}`);
	}
	if (rolesError) {
		throw new Error(`Failed to load user roles: ${rolesError.message}`);
	}

	const roleByUser = new Map<string, AppRole>();
	for (const row of roles ?? []) {
		if (isAppRole(row.role)) {
			roleByUser.set(row.user_id, row.role);
		}
	}

	return (profiles ?? []).map((p) => ({
		id: p.id,
		fullName: p.full_name,
		title: p.title ?? "",
		firstName: p.first_name ?? "",
		surname: p.surname ?? "",
		email: p.email,
		phone: p.phone ?? "",
		role: roleByUser.get(p.id) ?? null,
		isActive: p.is_active,
		locked: locked.has((p.email ?? "").toLowerCase()),
		invitePending: invited.has(p.id),
		createdAt: p.created_at,
	}));
}
