"use client";

import Link from "next/link";
import { Eye } from "lucide-react";
import { toast } from "sonner";
import {
	DataTable,
	ExportMenu,
	IconLink,
	StatusBadge,
	TableState,
	TableToolbar,
	exportRows,
	useTableRows,
	type ColumnDef,
	type ExportColumn,
	type ExportFormat,
} from "@/components/tables";
import { Button } from "@/components/common/buttons";
import { cn } from "@/lib/cn";
import {
	MACHINE_STATUS,
	dateLabel,
	everyLabel,
	statusOf,
	type Machine,
	type MachineStatus,
} from "@/lib/machines";
import { wholeNaira } from "@/lib/quoteBuilder";
import MachinePhoto from "./machinePhoto";

/** A row in the machines table: the machine with its condition worked out, so the table can filter on it. */
export type MachineRow = Machine & { status: MachineStatus };

export const machineColumns = (seesCost: boolean): ColumnDef<MachineRow>[] => [
	{
		key: "machine",
		header: "Machine",
		cell: (m) => (
			<span className="flex items-center gap-3">
				<MachinePhoto icon={m.icon} src={m.photoUrl} />
				<span className="flex min-w-0 flex-col">
					<Link
						href={`/machines/${m.id}`}
						className="font-bold text-fg no-underline hover:underline"
					>
						{m.name}
					</Link>
					<span className="text-small text-fg-tertiary">
						{m.serialNumber} · {m.location}
					</span>
				</span>
			</span>
		),
	},
	{
		key: "condition",
		header: "Condition",
		cell: (m) => (
			<StatusBadge tone={MACHINE_STATUS[m.status].tone}>
				{MACHINE_STATUS[m.status].label}
			</StatusBadge>
		),
	},
	{
		key: "last",
		header: "Last maintenance",
		cell: (m) => {
			const last = m.history[0];
			return (
				<span className="flex flex-col">
					<span className="font-bold text-fg">{last ? last.type : "—"}</span>
					<span className="text-small text-fg-tertiary">
						{last ? dateLabel(last.date) : "Nothing logged"}
					</span>
				</span>
			);
		},
	},
	{
		key: "next",
		header: "Next service",
		cell: (m) => (
			<span className="flex flex-col">
				<span
					className={cn(
						"whitespace-nowrap",
						m.status === "overdue" && "font-bold text-warning-fg",
					)}
				>
					{m.nextService ? dateLabel(m.nextService) : "When repaired"}
				</span>
				<span className="text-small text-fg-tertiary">
					{m.status === "overdue"
						? "Overdue"
						: m.status === "out_of_service"
							? "Waiting for a part"
							: `Every ${everyLabel(m.serviceEveryMonths)}`}
				</span>
			</span>
		),
	},
	...(seesCost
		? [
				{
					key: "rate",
					header: "Hourly cost",
					className: "text-end",
					cell: (m) => (
						<span className="font-bold whitespace-nowrap text-fg tabular">
							{wholeNaira(m.hourlyCost)}
						</span>
					),
				} satisfies ColumnDef<MachineRow>,
			]
		: []),
	{
		key: "actions",
		header: <span className="sr-only">Actions</span>,
		className: "w-14 text-end",
		cell: (m) => (
			<IconLink href={`/machines/${m.id}`} aria-label={`View ${m.name}`} title="View machine">
				<Eye aria-hidden="true" />
			</IconLink>
		),
	},
];

const STATUS_ORDER: MachineStatus[] = ["working", "overdue", "out_of_service"];

export default function MachinesTable({
	machines,
	today,
	seesCost,
	onAdd,
}: {
	machines: Machine[];
	today: string;
	seesCost: boolean;
	onAdd: () => void;
}) {
	const data: MachineRow[] = machines.map((m) => ({ ...m, status: statusOf(m, today) }));
	const { rows, pagination } = useTableRows({
		tableId: "machines",
		data,
		searchFields: ["name", "serialNumber"],
		filters: [{ paramKey: "condition", field: "status" }],
		rowsPerPage: 10,
	});

	const exportColumns: ExportColumn<MachineRow>[] = [
		{ header: "Machine", value: (m) => m.name },
		{ header: "Serial number", value: (m) => m.serialNumber },
		{ header: "Location", value: (m) => m.location },
		{ header: "Condition", value: (m) => MACHINE_STATUS[m.status].label },
		{ header: "Last maintenance", value: (m) => m.history[0]?.date, kind: "date" },
		{ header: "Next service", value: (m) => m.nextService, kind: "date" },
		...(seesCost
			? [
					{
						header: "Hourly cost (₦)",
						value: (m: MachineRow) => m.hourlyCost,
						kind: "money",
					} satisfies ExportColumn<MachineRow>,
				]
			: []),
	];

	const exportMachines = async (format: ExportFormat) => {
		await exportRows(data, exportColumns, {
			format,
			filename: `machines-${today}`,
			title: "Machines",
		});
		toast.success(`Exported ${data.length} machines.`);
	};

	return (
		<DataTable
			tableId="machines"
			columns={machineColumns(seesCost)}
			rows={rows}
			pagination={pagination}
			emptyMessage="No machines match your search. Try a different name or serial number."
			emptyState={
				data.length === 0 ? (
					<TableState
						kind="empty"
						title="No machines yet"
						description="Add each workshop machine so job cards can log machine time against it and its servicing is tracked."
						action={<Button onClick={onAdd}>Add machine</Button>}
					/>
				) : undefined
			}
			toolbar={
				<TableToolbar
					search={{ placeholder: "Machine or serial number" }}
					filters={[
						{
							title: "Condition",
							paramKey: "condition",
							items: STATUS_ORDER.map((s) => ({
								label: `${MACHINE_STATUS[s].label} (${data.filter((m) => m.status === s).length})`,
								value: s,
							})),
						},
					]}
					actions={<ExportMenu onExport={exportMachines} disabled={data.length === 0} />}
				/>
			}
		/>
	);
}
