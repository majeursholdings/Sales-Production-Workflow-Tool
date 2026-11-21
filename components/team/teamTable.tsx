"use client";

import { KeyRound, Pencil, ShieldOff, UserCheck } from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/common/badge";
import {
	DataTable,
	IconButton,
	TableToolbar,
	useTableRows,
	type ColumnDef,
} from "@/components/tables";
import { APP_ROLES, ROLE_LABELS, isOwnerAppRole, type AppRole } from "@/lib/roles";
import type { TeamMember } from "@/lib/team";

type TeamRow = TeamMember & {
	roleLabel: string;
	status: "Active" | "Deactivated";
};

const ROLE_TONE: Record<AppRole, BadgeVariant> = {
	md: "warning",
	gm: "warning",
	accounting: "info",
	procurement: "info",
	production: "neutral",
	sales: "success",
	customer_care: "success",
};

const initialsOf = (name: string) =>
	name
		.split(/\s+/)
		.map((word) => word[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();

export default function TeamTable({
	members,
	currentUserId,
	onEdit,
	onToggleActive,
	onSendReset,
}: {
	members: TeamMember[];
	currentUserId: string;
	onEdit: (member: TeamMember) => void;
	onToggleActive: (member: TeamMember) => void;
	onSendReset: (member: TeamMember) => void;
}) {
	const data: TeamRow[] = members.map((m) => ({
		...m,
		roleLabel: m.role ? ROLE_LABELS[m.role] : "Unassigned",
		status: m.isActive ? "Active" : "Deactivated",
	}));

	const { rows, pagination } = useTableRows({
		tableId: "team",
		data,
		searchFields: ["fullName", "email", "phone", "roleLabel"],
		filters: [
			{ paramKey: "role", field: "role" },
			{ paramKey: "status", field: "status" },
		],
		rowsPerPage: 10,
	});

	const columns: ColumnDef<TeamRow>[] = [
		{
			key: "person",
			header: "Person",
			cell: (m) => (
				<span className="flex items-center gap-3">
					<span
						aria-hidden="true"
						className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-subtle text-small font-bold text-accent-fg"
					>
						{initialsOf(m.fullName)}
					</span>
					<span className="flex min-w-0 flex-col">
						<span className="font-bold text-fg">
							{m.fullName}
							{m.id === currentUserId && (
								<span className="ms-1.5 text-small font-normal text-fg-tertiary">
									(You)
								</span>
							)}
						</span>
						<span className="text-small [overflow-wrap:anywhere] text-fg-tertiary">
							{m.email}
						</span>
					</span>
				</span>
			),
		},
		{
			key: "role",
			header: "Role",
			cell: (m) =>
				m.role ? (
					<Badge variant={ROLE_TONE[m.role]}>
						{ROLE_LABELS[m.role]}
						{isOwnerAppRole(m.role) ? " · Admin" : ""}
					</Badge>
				) : (
					<Badge variant="danger">No role</Badge>
				),
		},
		{
			key: "status",
			header: "Status",
			cell: (m) => (
				<Badge variant={m.isActive ? "success" : "neutral"}>
					{m.isActive ? "Active" : "Deactivated"}
				</Badge>
			),
		},
		{
			key: "actions",
			header: <span className="sr-only">Actions</span>,
			className: "w-32 text-end",
			cell: (m) => (
				<span className="inline-flex items-center justify-end gap-1">
					<IconButton
						aria-label={`Edit ${m.fullName}`}
						title="Edit person & role"
						onClick={() => onEdit(m)}
					>
						<Pencil aria-hidden="true" />
					</IconButton>
					<IconButton
						aria-label={`Send password reset to ${m.fullName}`}
						title="Send password reset email"
						onClick={() => onSendReset(m)}
					>
						<KeyRound aria-hidden="true" />
					</IconButton>
					{m.id !== currentUserId && (
						<IconButton
							aria-label={
								m.isActive ? `Deactivate ${m.fullName}` : `Reactivate ${m.fullName}`
							}
							title={m.isActive ? "Deactivate account" : "Reactivate account"}
							onClick={() => onToggleActive(m)}
						>
							{m.isActive ? (
								<ShieldOff aria-hidden="true" />
							) : (
								<UserCheck aria-hidden="true" />
							)}
						</IconButton>
					)}
				</span>
			),
		},
	];

	return (
		<DataTable
			tableId="team"
			columns={columns}
			rows={rows}
			pagination={pagination}
			emptyMessage="No team accounts match your search."
			toolbar={
				<TableToolbar
					search={{ placeholder: "Name, email or role" }}
					filters={[
						{
							title: "Role",
							paramKey: "role",
							items: APP_ROLES.map((role) => ({
								label: ROLE_LABELS[role],
								value: role,
							})),
						},
						{
							title: "Status",
							paramKey: "status",
							items: [
								{ label: "Active", value: "Active" },
								{ label: "Deactivated", value: "Deactivated" },
							],
						},
					]}
				/>
			}
		/>
	);
}
