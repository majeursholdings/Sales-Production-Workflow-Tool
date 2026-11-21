import type { StaffMember, StaffTeam } from "@/lib/staff";
import { createClient } from "@/utils/supabase/server";

export async function getStaff(): Promise<StaffMember[]> {
	const supabase = await createClient();
	const { data, error } = await supabase
		.from("staff_members")
		.select("id, full_name, role, team, phone, email, hourly_rate, hours_per_month, notes")
		.eq("is_active", true)
		.order("team", { ascending: false })
		.order("full_name", { ascending: true });

	if (error) {
		throw new Error(`Failed to load staff: ${error.message}`);
	}

	return (data ?? []).map((row) => ({
		id: row.id,
		name: row.full_name,
		role: row.role,
		team: row.team as StaffTeam,
		phone: row.phone ?? "",
		email: row.email ?? "",
		rate: Number(row.hourly_rate),
		hoursPerMonth: Number(row.hours_per_month),
		notes: row.notes ?? "",
	}));
}
