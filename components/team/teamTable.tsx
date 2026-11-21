"use client";

import { KeyRound, Pencil, UserCheck, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/common/badge";
import {
	DataTable,
	ExportMenu,
	IconButton,
	TableState,
	TableToolbar,
	exportRows,
	useTableRows,
	type ColumnDef,
	type ExportColumn,
	type ExportFormat,
} from "@/components/tables";
import { ROLE_LABELS, isOwnerAppRole, type AppRole } from "@/lib/roles";
import type { TeamMember } from "@/lib/team";

/** The role filter groups roles the way the permissions guide does. */
const ROLE_GROUPS = [
	{ value: "lead", label: "MD & GM" },
	{ value: "accounting", label: "Accounting" },
	{ value: "care", label: "Customer care & sales" },
	{ value: "procurement", label: "Procurement" },
	{ value: "production", label: "Production" },
] as const;

type RoleGroup = (typeof ROLE_GROUPS)[number]["value"];

const GROUP_OF: Record<AppRole, RoleGroup> = {
	md: "lead",
	gm: "lead",
	accounting: "accounting",
	sales: "care",
	customer_care: "care",
	procurement: "procurement",
	production: "production",
};

const ACTIVE = "Active";
const REMOVED = "Access removed";

export type TeamRow = TeamMember & {
	roleLabel: string;
	roleGroup: RoleGroup | "none";
	status: typeof ACTIVE | typeof REMOVED;
};

type Handlers = {
	currentUserId: string;
	onEdit: (member: TeamMember) => void;
	onToggleActive: (member: TeamMember) => void;
	onSendReset: (member: TeamMember) => void;
};

const initialsOf = (name: string) =>
	name
		.split(/\s+/)
		.map((word) => word[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();

/** Columns for the people table. Called with no handlers by the loading skeleton, which only needs the headers. */
export function teamColumns(handlers?: Handlers): ColumnDef<TeamRow>[] {
	const { currentUserId = "", onEdit, onToggleActive, onSendReset } = handlers ?? {};
	return [
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
						<span className="text-small wrap-anywhere text-fg-tertiary">{m.email}</span>
					</span>
				</span>
			),
		},
		{
			key: "role",
			header: "Role",
			cell: (m) =>
				m.role ? (
					<span className="flex flex-col">
						<span>{ROLE_LABELS[m.role]}</span>
						{isOwnerAppRole(m.role) && (
							<span className="text-small text-fg-tertiary">
								Can manage people and roles
							</span>
						)}
					</span>
				) : (
					<Badge variant="danger">No role</Badge>
				),
		},
		{
			key: "status",
			header: "Status",
			cell: (m) => (
				<Badge variant={m.isActive ? "success" : "neutral"}>
					{m.isActive ? ACTIVE : REMOVED}
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
						aria-label={`Send password reset to ${m.fullName}`}
						title="Send password reset email"
						onClick={() => onSendReset?.(m)}
					>
						<KeyRound aria-hidden="true" />
					</IconButton>
					<IconButton
						aria-label={`Edit ${m.fullName}'s role`}
						title="Edit"
						onClick={() => onEdit?.(m)}
					>
						<Pencil aria-hidden="true" />
					</IconButton>
					{m.id !== currentUserId ? (
						<IconButton
							danger={m.isActive}
							aria-label={
								m.isActive
									? `Remove ${m.fullName}'s access`
									: `Restore ${m.fullName}'s access`
							}
							title={m.isActive ? "Remove access" : "Restore access"}
							onClick={() => onToggleActive?.(m)}
						>
							{m.isActive ? (
								<UserMinus aria-hidden="true" />
							) : (
								<UserCheck aria-hidden="true" />
							)}
						</IconButton>
					) : (
						// keeps the icons lined up with the rows that have a third button
						<span aria-hidden="true" className="inline-block size-8" />
					)}
				</span>
			),
		},
	];
}

const exportColumns: ExportColumn<TeamRow>[] = [
	{ header: "Name", value: (m) => m.fullName },
	{ header: "Email", value: (m) => m.email },
	{ header: "Role", value: (m) => m.roleLabel },
	{ header: "Status", value: (m) => m.status },
];

export default function TeamTable({
	members,
	currentUserId,
	onEdit,
	onToggleActive,
	onSendReset,
}: {
	members: TeamMember[];
} & Handlers) {
	const data: TeamRow[] = members.map((m) => ({
		...m,
		roleLabel: m.role ? ROLE_LABELS[m.role] : "Unassigned",
		roleGroup: m.role ? GROUP_OF[m.role] : "none",
		status: m.isActive ? ACTIVE : REMOVED,
	}));

	const { rows, pagination } = useTableRows({
		tableId: "team",
		data,
		searchFields: ["fullName", "email", "roleLabel"],
		filters: [
			{ paramKey: "role", field: "roleGroup" },
			{ paramKey: "status", field: "status" },
		],
		rowsPerPage: 10,
	});

	const exportPeople = async (format: ExportFormat) => {
		await exportRows(data, exportColumns, {
			format,
			filename: `team-${new Date().toISOString().slice(0, 10)}`,
			title: "Team & access",
		});
		toast.success(`Exported ${data.length} people with their roles and status.`);
	};

	return (
		<DataTable
			tableId="team"
			columns={teamColumns({ currentUserId, onEdit, onToggleActive, onSendReset })}
			rows={rows}
			pagination={pagination}
			emptyMessage="No one matches your search. Try a different name or email."
			emptyState={
				members.length === 0 ? (
					<TableState
						kind="empty"
						title="No team accounts yet"
						description="People you add will appear here with their role and access."
					/>
				) : undefined
			}
			toolbar={
				<>
					<TableHead count={members.length} />
					<TableToolbar
						search={{ placeholder: "Name or email" }}
						filters={[
							{
								title: "Role",
								paramKey: "role",
								placeholder: "All roles",
								items: ROLE_GROUPS.map(({ value, label }) => ({ label, value })),
							},
							{
								title: "Status",
								paramKey: "status",
								items: [
									{ label: ACTIVE, value: ACTIVE },
									{ label: REMOVED, value: REMOVED },
								],
							},
						]}
						actions={
							<ExportMenu onExport={exportPeople} disabled={data.length === 0} />
						}
					/>
				</>
			}
		/>
	);
}

/** The "People" heading row at the top of the table's card. */
export function TableHead({ count }: { count?: number }) {
	return (
		<div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
			<h2 className="flex-1">People</h2>
			{count !== undefined && (
				<span className="text-small text-fg-tertiary">
					{count} {count === 1 ? "person" : "people"}
				</span>
			)}
		</div>
	);
}
