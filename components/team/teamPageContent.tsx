"use client";

import { Suspense, useState } from "react";
import { Plus, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/common/buttons";
import { Card } from "@/components/common/card";
import { ConfirmDialog } from "@/components/common/modal";
import PageTitle from "@/components/layout/pageTitle";
import { ROLE_LABELS } from "@/lib/roles";
import type { TeamMember } from "@/lib/team";
import {
	sendTeamPasswordResetAction,
	setTeamMemberActiveAction,
} from "@/app/(dashboard)/team/actions";
import AddPersonCard from "./addPersonCard";
import RolePermissionsCard from "./rolePermissionsCard";
import TeamDrawer from "./teamDrawer";
import TeamTable from "./teamTable";
import TeamTableSkeleton from "./teamTableSkeleton";
import { teamTitle } from "./teamTitle";

/**
 * The page title (with "Add person"), the add panel, the people table and the
 * permissions guide. The table and the panel share the member list, so they live together here.
 */
export default function TeamPageContent({
	initialMembers,
	currentUserId,
	canCreateUsers,
}: {
	initialMembers: TeamMember[];
	currentUserId: string;
	canCreateUsers: boolean;
}) {
	const [members, setMembers] = useState(initialMembers);
	const [adding, setAdding] = useState(false);
	const [editing, setEditing] = useState<TeamMember | null>(null);
	const [toggling, setToggling] = useState<TeamMember | null>(null);
	const [busy, setBusy] = useState(false);

	const handleToggleActive = async () => {
		if (!toggling || busy) return;
		setBusy(true);
		const nextActive = !toggling.isActive;
		const result = await setTeamMemberActiveAction({
			userId: toggling.id,
			isActive: nextActive,
		});
		setBusy(false);

		if (!result.ok) {
			toast.error(result.message);
			return;
		}

		setMembers((prev) =>
			prev.map((m) => (m.id === toggling.id ? { ...m, isActive: nextActive } : m)),
		);
		toast.success(
			nextActive
				? `${toggling.fullName}'s access was restored.`
				: `${toggling.fullName}'s access was removed.`,
		);
		setToggling(null);
	};

	const handleSendReset = async (member: TeamMember) => {
		const result = await sendTeamPasswordResetAction(member.email);
		if (!result.ok) {
			toast.error(result.message);
			return;
		}
		toast.success(`Password reset link sent to ${member.email}.`);
	};

	const firstName = toggling?.fullName.split(" ")[0] ?? "";

	return (
		<>
			<PageTitle
				{...teamTitle}
				actions={
					<Button
						variant="primary"
						onClick={() => setAdding((open) => !open)}
						aria-expanded={adding}
						disabled={!canCreateUsers}
						title={
							canCreateUsers
								? "Invite a new team member"
								: "Add SUPABASE_SECRET_KEY to .env.local to create accounts"
						}
					>
						<Plus />
						Add person
					</Button>
				}
			/>

			{!canCreateUsers && (
				<Card className="flex-row items-start gap-3 border-warning-line bg-warning-subtle">
					<ShieldAlert
						className="mt-0.5 size-5 shrink-0 text-warning-fg"
						aria-hidden="true"
					/>
					<div className="flex flex-col gap-1 text-small text-warning-fg">
						<strong className="font-bold">
							Server secret key needed to add new users
						</strong>
						<p>
							Add <code>SUPABASE_SECRET_KEY</code> to <code>.env.local</code> (from
							Supabase Dashboard → Project Settings → API Keys) to create accounts,
							send invites, and revoke sessions directly from here. You can still edit
							roles for existing users below.
						</p>
					</div>
				</Card>
			)}

			{adding && canCreateUsers && (
				<AddPersonCard
					onCancel={() => setAdding(false)}
					onAdded={(member) => {
						setMembers((prev) => [...prev, member]);
						setAdding(false);
						toast.success(
							`Invite sent to ${member.email}. ${member.fullName} joins as ${
								member.role ? ROLE_LABELS[member.role] : "a team member"
							}.`,
						);
					}}
				/>
			)}

			{/* the table keeps its search, filters and page in the URL, which needs Suspense on a static page */}
			<Suspense fallback={<TeamTableSkeleton />}>
				<TeamTable
					members={members}
					currentUserId={currentUserId}
					onEdit={setEditing}
					onToggleActive={setToggling}
					onSendReset={handleSendReset}
				/>
			</Suspense>

			<RolePermissionsCard />

			{editing && (
				<TeamDrawer
					key={editing.id}
					member={editing}
					onClose={() => setEditing(null)}
					onSaved={(saved) => {
						setMembers((prev) => prev.map((m) => (m.id === saved.id ? saved : m)));
						setEditing(null);
						toast.success(`${saved.fullName} updated.`);
					}}
				/>
			)}

			{toggling && (
				<ConfirmDialog
					title={
						toggling.isActive
							? `Remove ${toggling.fullName}'s access?`
							: `Restore ${toggling.fullName}'s access?`
					}
					confirmLabel={toggling.isActive ? "Remove access" : "Restore access"}
					onCancel={() => setToggling(null)}
					onConfirm={handleToggleActive}
				>
					{toggling.isActive
						? `${firstName} is signed out straight away and can't sign in again. Quotes, invoices and notes they created keep their name.`
						: `${firstName} will be able to sign in again with their assigned role.`}
				</ConfirmDialog>
			)}
		</>
	);
}
