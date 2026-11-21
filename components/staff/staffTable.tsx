"use client";

import { Pencil } from "lucide-react";
import { toast } from "sonner";
import {
	DataTable,
	ExportMenu,
	IconButton,
	TableToolbar,
	exportRows,
	useTableRows,
	type ColumnDef,
	type ExportColumn,
	type ExportFormat,
} from "@/components/tables";
import { useTableParam } from "@/components/tables/tableContext";
import { cn } from "@/lib/cn";
import { wholeNaira } from "@/lib/quoteBuilder";
import { monthlyCost, type StaffMember, type StaffTeam } from "@/lib/staff";

const exportColumns: ExportColumn<StaffMember>[] = [
	{ header: "Name", value: (p) => p.name },
	{ header: "Role", value: (p) => p.role },
	{ header: "Team", value: (p) => p.team },
	{ header: "Phone", value: (p) => p.phone },
	{ header: "Email", value: (p) => p.email },
	{ header: "Hourly rate (₦)", value: (p) => p.rate, kind: "money" },
	{ header: "Hours a month", value: (p) => p.hoursPerMonth, kind: "number" },
	{ header: "Monthly cost (₦)", value: (p) => monthlyCost(p), kind: "money" },
];

/** Production staff are green and the backend team brown, matching the legend in the toolbar. */
const teamColour: Record<StaffTeam, string> = {
	Production: "bg-success-subtle text-success-fg",
	"Non-production": "bg-accent-subtle text-accent-fg",
};

const initialsOf = (name: string) =>
	name
		.split(/\s+/)
		.map((w) => w[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();

function TeamLegend() {
	return (
		<span className="flex items-center gap-3 text-small text-fg-secondary">
			{(["Production", "Non-production"] as const).map((team) => (
				<span key={team} className="flex items-center gap-1.5">
					<span
						aria-hidden="true"
						className={cn(
							"size-2.5 rounded-full",
							team === "Production" ? "bg-success-fg" : "bg-accent",
						)}
					/>
					{team}
				</span>
			))}
		</span>
	);
}

export const staffColumns = (onEdit?: (person: StaffMember) => void): ColumnDef<StaffMember>[] => [
	{
		key: "name",
		header: "Name and role",
		cell: (p) => (
			<span className="flex items-center gap-3">
				<span
					role="img"
					aria-label={`${p.name}, ${p.team.toLowerCase()} team`}
					className={cn(
						"grid size-8 shrink-0 place-items-center rounded-full text-small font-bold",
						teamColour[p.team],
					)}
				>
					{initialsOf(p.name)}
				</span>
				<span className="flex min-w-0 flex-col">
					<span className="font-bold text-fg">{p.name}</span>
					<span className="text-small text-fg-tertiary">{p.role}</span>
				</span>
			</span>
		),
	},
	{
		key: "contact",
		header: "Phone and email",
		cell: (p) => (
			<span className="flex flex-col">
				<a href={`tel:${p.phone.replace(/\s/g, "")}`}>{p.phone}</a>
				<a href={`mailto:${p.email}`} className="[overflow-wrap:anywhere]">
					{p.email}
				</a>
			</span>
		),
	},
	{
		key: "rate",
		header: "Rate",
		className: "text-end",
		cell: (p) => (
			<span className="flex flex-col">
				<span className="font-bold whitespace-nowrap text-fg tabular">
					{wholeNaira(p.rate)}/h
				</span>
				<span className="text-small whitespace-nowrap text-fg-tertiary tabular">
					{wholeNaira(monthlyCost(p))} a month
				</span>
			</span>
		),
	},
	{
		key: "actions",
		header: <span className="sr-only">Actions</span>,
		className: "w-12 text-end",
		cell: (p) => (
			<IconButton aria-label={`Edit ${p.name}`} title="Edit" onClick={() => onEdit?.(p)}>
				<Pencil aria-hidden="true" />
			</IconButton>
		),
	},
];

export default function StaffTable({
	staff,
	onEdit,
}: {
	staff: StaffMember[];
	onEdit: (person: StaffMember) => void;
}) {
	const { rows, pagination } = useTableRows({
		tableId: "staff",
		data: staff,
		searchFields: ["name", "role", "phone", "email"],
		filters: [{ paramKey: "team", field: "team" }],
		rowsPerPage: 10,
	});

	// The total follows the Team filter (not the search, which is for finding someone)
	const team = useTableParam("staff").getParam("team");
	const counted = team ? staff.filter((p) => p.team === team) : staff;
	const total = counted.reduce((sum, p) => sum + monthlyCost(p), 0);
	const count = (t: StaffTeam) => staff.filter((p) => p.team === t).length;

	const exportStaff = async (format: ExportFormat) => {
		await exportRows(staff, exportColumns, {
			format,
			filename: `staff-${new Date().toISOString().slice(0, 10)}`,
			title: "Staff",
		});
		toast.success(`Exported ${staff.length} staff with roles and rates.`);
	};

	return (
		<div className="flex min-w-0 flex-col gap-3">
			<DataTable
				tableId="staff"
				columns={staffColumns(onEdit)}
				rows={rows}
				pagination={pagination}
				emptyMessage="No staff match your search. Try a different name, role, phone or email."
				toolbar={
					<TableToolbar
						search={{ placeholder: "Name, role, phone or email" }}
						filters={[
							{
								title: "Team",
								paramKey: "team",
								items: [
									{
										label: `Production (${count("Production")})`,
										value: "Production",
									},
									{
										label: `Non-production (${count("Non-production")})`,
										value: "Non-production",
									},
								],
							},
						]}
						actions={
							<>
								<TeamLegend />
								<ExportMenu onExport={exportStaff} disabled={staff.length === 0} />
							</>
						}
					/>
				}
			/>
			<div className="flex flex-wrap justify-between gap-2 rounded-lg border border-line bg-surface px-5 py-4 text-body">
				<span className="text-fg-secondary">{team ?? "All staff"}, per month</span>
				<strong className="text-fg tabular">{wholeNaira(total)}</strong>
			</div>
		</div>
	);
}
