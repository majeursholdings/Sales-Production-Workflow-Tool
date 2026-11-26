"use client";

import { Pencil, Trash2 } from "lucide-react";
import { Chip } from "@/components/common/badge";
import {
	DataTable,
	IconButton,
	TableToolbar,
	useTableRows,
	type ColumnDef,
} from "@/components/tables";
import { MAINTENANCE_TYPES, dateLabel, type MaintenanceRecord } from "@/lib/machines";
import { wholeNaira } from "@/lib/quoteBuilder";

export const maintenanceColumns = ({
	canDelete,
	onEdit,
	onDelete,
}: {
	canDelete: boolean;
	onEdit?: (record: MaintenanceRecord) => void;
	onDelete?: (record: MaintenanceRecord) => void;
}): ColumnDef<MaintenanceRecord>[] => [
	{
		key: "date",
		header: "Date",
		cell: (r) => (
			<span className="font-bold whitespace-nowrap text-fg">{dateLabel(r.date)}</span>
		),
	},
	{
		key: "what",
		header: "Maintenance",
		cell: (r) => (
			<span className="flex flex-col items-start gap-1">
				<Chip>{r.type}</Chip>
				<span className="text-small text-fg-secondary">{r.notes}</span>
				{r.photos.length > 0 ? (
					<span className="mt-1 flex flex-wrap gap-1.5">
						{r.photos.map((url, idx) => (
							<a
								key={url}
								href={url}
								target="_blank"
								rel="noreferrer"
								title={`Open photo ${idx + 1}`}
								className="block overflow-hidden rounded-sm border border-line"
							>
								{/* eslint-disable-next-line @next/next/no-img-element -- served from authenticated /api/storage route */}
								<img
									src={url}
									alt={`${r.type} photo ${idx + 1}`}
									className="size-10 object-cover"
								/>
							</a>
						))}
					</span>
				) : (
					r.photoCount > 0 && (
						<span className="text-small text-fg-tertiary">
							{r.photoCount} {r.photoCount === 1 ? "photo" : "photos"}
						</span>
					)
				)}
			</span>
		),
	},
	{
		key: "by",
		header: "Done by",
		cell: (r) => (
			<span className="flex flex-col">
				<span>{r.doneBy}</span>
				<span className="text-small text-fg-tertiary">Logged by {r.loggedBy}</span>
			</span>
		),
	},
	{
		key: "cost",
		header: "Cost",
		className: "text-end",
		cell: (r) => (
			<span className="whitespace-nowrap tabular">{r.cost ? wholeNaira(r.cost) : "—"}</span>
		),
	},
	{
		key: "actions",
		header: <span className="sr-only">Actions</span>,
		className: "w-24 text-end",
		cell: (r) => (
			<span className="inline-flex gap-1">
				<IconButton
					aria-label={`Edit ${r.type.toLowerCase()} on ${dateLabel(r.date)}`}
					title="Edit"
					onClick={() => onEdit?.(r)}
				>
					<Pencil aria-hidden="true" />
				</IconButton>
				{canDelete && (
					<IconButton
						danger
						aria-label={`Delete ${r.type.toLowerCase()} on ${dateLabel(r.date)}`}
						title="Delete"
						onClick={() => onDelete?.(r)}
					>
						<Trash2 aria-hidden="true" />
					</IconButton>
				)}
			</span>
		),
	},
];

export default function MaintenanceTable({
	history,
	canDelete,
	permissionNote,
	onEdit,
	onDelete,
}: {
	history: MaintenanceRecord[];
	canDelete: boolean;
	permissionNote: string;
	onEdit: (record: MaintenanceRecord) => void;
	onDelete: (record: MaintenanceRecord) => void;
}) {
	const { rows, pagination } = useTableRows({
		tableId: "maintenance",
		data: history,
		filters: [{ paramKey: "type", field: "type" }],
		rowsPerPage: 10,
	});

	return (
		<div className="flex min-w-0 flex-col gap-3">
			<DataTable
				tableId="maintenance"
				columns={maintenanceColumns({ canDelete, onEdit, onDelete })}
				rows={rows}
				pagination={pagination}
				emptyMessage={
					history.length === 0
						? "No maintenance logged yet. Use Log maintenance when the first job is done."
						: "No maintenance of this type logged yet."
				}
				toolbar={
					<TableToolbar
						filters={[
							{
								title: "Type",
								paramKey: "type",
								items: MAINTENANCE_TYPES.map((t) => ({
									label: `${t} (${history.filter((r) => r.type === t).length})`,
									value: t,
								})),
							},
						]}
					/>
				}
			/>
			<p className="text-small text-fg-tertiary">{permissionNote}</p>
		</div>
	);
}
