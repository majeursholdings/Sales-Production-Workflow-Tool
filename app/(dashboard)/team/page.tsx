import type { Metadata } from "next";
import TeamPageView from "@/components/pages/team";
import { requireOwner } from "@/lib/session";
import { getTeamMembers } from "@/lib/team";
import { hasAdminClient } from "@/utils/supabase/admin";

export const metadata: Metadata = { title: "Team & access" };

export default async function TeamPage() {
	const [user, members] = await Promise.all([requireOwner(), getTeamMembers()]);
	return (
		<TeamPageView members={members} currentUserId={user.id} canCreateUsers={hasAdminClient()} />
	);
}
