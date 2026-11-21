"use client";

import { Suspense, useState } from "react";
import { Plus, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/common/buttons";
import { Card } from "@/components/common/card";
import { ConfirmDialog } from "@/components/common/modal";
import OverviewCards, { type OverviewItem } from "@/components/common/overViewCard";
import PageTitle from "@/components/layout/pageTitle";
import { APP_ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS, isOwnerAppRole } from "@/lib/roles";
import type { TeamMember } from "@/lib/team";
import {
	sendTeamPasswordResetAction,
	setTeamMemberActiveAction,
} from "@/app/(dashboard)/team/actions";
import TeamDrawer from "./teamDrawer";
import TeamTable from "./teamTable";

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
	const [drawer, setDrawer] = useState<TeamMember | "new" | null>(null);
	const [toggling, setToggling] = useState<TeamMember | null>(null);
	const [busy, setBusy] = useState(false);

	const activeCount = members.filter((m) => m.isActive).length;
	const deactivatedCount = members.length - activeCount;
	const ownerCount = members.filter((m) => m.isActive && m.role && isOwnerAppRole(m.role)).length;
	const assignedRoles = new Set(members.filter((m) => m.isActive && m.role).map((m) => m.role))
		.size;

	const overview: OverviewItem[] = [
		{
			label: "Team accounts",
			value: String(members.length),
			note: `${activeCount} active · ${deactivatedCount} deactivated`,
		},
		{
			label: "Superadmins (MD / GM)",
			value: String(ownerCount),
			note: "Full access & user management",
		},
		{
			label: "Roles covered",
			value: `${assignedRoles} of ${APP_ROLES.length}`,
			note: "Active role assignments",
		},
	];

	const editing = drawer && drawer !== "new" ? drawer : undefined;

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
				? `${toggling.fullName} has been reactivated.`
				: `${toggling.fullName} has been deactivated and blocked from signing in.`,
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

	return (
		<>
			<PageTitle
				pageTitle="Team & access"
				pageDescription="Who can sign in, what role they have, and what they can see."
				actions={
					<Button
						variant="primary"
						onClick={() => setDrawer("new")}
						disabled={!canCreateUsers}
						title={
							canCreateUsers
								? "Create a new team account"
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

			<OverviewCards aria-label="Team access overview" items={overview} />

			<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
				<Suspense fallback={null}>
					<TeamTable
						members={members}
						currentUserId={currentUserId}
						onEdit={(member) => setDrawer(member)}
						onToggleActive={(member) => setToggling(member)}
						onSendReset={handleSendReset}
					/>
				</Suspense>

				<aside aria-label="Role permissions guide" className="flex min-w-0 flex-col gap-6">
					<Card>
						<h2>Roles &amp; what they see</h2>
						<p className="text-small text-fg-tertiary">
							Each account has one role enforced on the server and in Postgres Row
							Level Security.
						</p>
						<ul className="flex flex-col">
							{APP_ROLES.map((role) => (
								<li
									key={role}
									className="flex flex-col gap-0.5 border-t border-line py-2.5 first:border-t-0"
								>
									<strong className="text-body text-fg">
										{ROLE_LABELS[role]}
									</strong>
									<span className="text-small text-fg-secondary">
										{ROLE_DESCRIPTIONS[role]}
									</span>
								</li>
							))}
						</ul>
					</Card>
				</aside>
			</div>

			{drawer && (
				<TeamDrawer
					key={editing?.id ?? "new"}
					member={editing}
					onClose={() => setDrawer(null)}
					onSaved={(saved, isNew) => {
						setMembers((prev) =>
							isNew
								? [...prev, saved]
								: prev.map((m) => (m.id === saved.id ? saved : m)),
						);
						setDrawer(null);
						toast.success(
							isNew
								? `${saved.fullName} added as ${saved.role ? ROLE_LABELS[saved.role] : "a team member"}.`
								: `${saved.fullName} updated.`,
						);
					}}
				/>
			)}

			{toggling && (
				<ConfirmDialog
					title={
						toggling.isActive
							? `Deactivate ${toggling.fullName}?`
							: `Reactivate ${toggling.fullName}?`
					}
					confirmLabel={toggling.isActive ? "Deactivate account" : "Reactivate account"}
					onCancel={() => setToggling(null)}
					onConfirm={handleToggleActive}
				>
					{toggling.isActive
						? "They will be blocked from signing in and accessing any data immediately. Their past quotes and activity history stay intact."
						: "They will be able to sign in again with their assigned role."}
				</ConfirmDialog>
			)}
		</>
	);
}
