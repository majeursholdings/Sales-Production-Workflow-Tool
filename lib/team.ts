import { isAppRole, type AppRole } from "@/lib/roles";
import { requireOwner } from "@/lib/session";
import { createClient } from "@/utils/supabase/server";

export type TeamMember = {
	id: string;
	fullName: string;
	email: string;
	phone: string;
	role: AppRole | null;
	isActive: boolean;
	createdAt: string;
};

export async function getTeamMembers(): Promise<TeamMember[]> {
	await requireOwner();
	const supabase = await createClient();

	const [{ data: profiles, error: profilesError }, { data: roles, error: rolesError }] =
		await Promise.all([
			supabase
				.from("profiles")
				.select("id, full_name, email, phone, is_active, created_at")
				.order("created_at", { ascending: true }),
			supabase.from("user_roles").select("user_id, role"),
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
		email: p.email,
		phone: p.phone ?? "",
		role: roleByUser.get(p.id) ?? null,
		isActive: p.is_active,
		createdAt: p.created_at,
	}));
}
