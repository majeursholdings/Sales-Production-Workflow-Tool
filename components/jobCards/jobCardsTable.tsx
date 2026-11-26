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
import { cn } from "@/lib/cn";
import {
	STEP_NAMES,
	cardFigures,
	dueNote,
	fmtHours,
	longDate,
	phaseOf,
	stepLabel,
	type JobCard,
	type JobPhase,
} from "@/lib/jobCards";
import FurnitureIcon from "./furnitureIcon";
import HoursBar from "./hoursBar";

/** A row in the job cards table: the card with its step and hours worked out, so the table can filter on them. */
export type JobCardRow = JobCard & {
	phase: JobPhase;
	step: ReturnType<typeof stepLabel>;
	stepNote: string;
	hours: number;
	planned: number;
	redoHours: number;
	dueInfo: ReturnType<typeof dueNote>;
};

export const toRow = (card: JobCard, today: string): JobCardRow => {
	const f = cardFigures(card);
	return {
		...card,
		phase: phaseOf(card),
		step: stepLabel(card, f.current),
		stepNote: card.closed
			? `All ${STEP_NAMES.length} steps done`
			: f.current === null
				? ""
				: `Step ${f.current + 1} of ${STEP_NAMES.length}`,
		hours: f.hours,
		planned: f.planned,
		redoHours: f.redoHours,
		dueInfo: dueNote(card, today),
	};
};

export const jobCardColumns: ColumnDef<JobCardRow>[] = [
	{
		key: "job",
		header: "Job card",
		cell: (j) => (
			<span className="flex items-center gap-3">
				<FurnitureIcon kind={j.icon} />
				<span className="flex min-w-0 flex-col">
					<Link
						href={`/work-orders/${j.id}`}
						className="font-bold text-fg no-underline hover:underline"
					>
						{j.client}
					</Link>
					<span className="text-small text-fg-tertiary">
						{j.id} · {j.items}
					</span>
				</span>
			</span>
		),
	},
	{
		key: "step",
		header: "Step",
		cell: (j) => (
			<span className="flex flex-col items-start gap-1">
				<StatusBadge tone={j.step.tone}>{j.step.label}</StatusBadge>
				{j.stepNote && <span className="text-small text-fg-tertiary">{j.stepNote}</span>}
			</span>
		),
	},
	{
		key: "hours",
		header: "Hours",
		className: "text-end",
		cell: (j) => (
			<span className="flex flex-col items-end">
				<span className="flex items-center gap-2">
					<HoursBar actual={j.hours} planned={j.planned} />
					<span className="font-bold whitespace-nowrap text-fg tabular">
						{fmtHours(j.hours)}
					</span>
				</span>
				<span className="text-small whitespace-nowrap text-fg-tertiary">
					of {fmtHours(j.planned)} planned
					{j.redoHours > 0 && ` · ${fmtHours(j.redoHours)} redo`}
				</span>
			</span>
		),
	},
	{
		key: "due",
		header: "Due",
		cell: (j) => (
			<span className="flex flex-col">
				<span
					className={cn(
						"whitespace-nowrap",
						j.dueInfo.urgent && "font-bold text-warning-fg",
					)}
				>
					{longDate(j.due)}
				</span>
				<span className="text-small text-fg-tertiary">{j.dueInfo.text}</span>
			</span>
		),
	},
	{
		key: "actions",
		header: <span className="sr-only">Actions</span>,
		className: "w-14 text-end",
		cell: (j) => (
			<IconLink
				href={`/work-orders/${j.id}`}
				aria-label={`View job card ${j.id} for ${j.client}`}
				title="View job card"
			>
				<Eye aria-hidden="true" />
			</IconLink>
		),
	},
];

const PHASES: { value: JobPhase; label: string }[] = [
	{ value: "active", label: "Active" },
	{ value: "delivered", label: "Delivered" },
];

export default function JobCardsTable({
	cards,
	today,
	canCreate,
}: {
	cards: JobCard[];
	today: string;
	canCreate: boolean;
}) {
	const data = cards.map((c) => toRow(c, today));
	const { rows, pagination } = useTableRows({
		tableId: "job-cards",
		data,
		searchFields: ["client", "id", "items"],
		filters: [{ paramKey: "show", field: "phase" }],
		rowsPerPage: 10,
	});

	const exportColumns: ExportColumn<JobCardRow>[] = [
		{ header: "Job card", value: (j) => j.id },
		{ header: "Client", value: (j) => j.client },
		{ header: "Items", value: (j) => j.items },
		{ header: "Step", value: (j) => j.step.label },
		{ header: "Hours logged", value: (j) => j.hours },
		{ header: "Hours planned", value: (j) => j.planned },
		{ header: "Due", value: (j) => j.due, kind: "date" },
	];

	const exportJobCards = async (format: ExportFormat) => {
		await exportRows(data, exportColumns, {
			format,
			filename: `job-cards-${today}`,
			title: "Job cards",
		});
		toast.success(`Exported ${data.length} job cards.`);
	};

	return (
		<DataTable
			tableId="job-cards"
			columns={jobCardColumns}
			rows={rows}
			pagination={pagination}
			emptyMessage="No job cards match your search. Try a different client, item or job card number."
			emptyState={
				data.length === 0 ? (
					<TableState
						kind="empty"
						title="No job cards yet"
						description={
							canCreate
								? "Start one with New job card once a quote's deposit is paid."
								: "Job cards show up here once a quote's deposit is paid and production starts it."
						}
					/>
				) : undefined
			}
			toolbar={
				<TableToolbar
					search={{ placeholder: "Job card, client or item" }}
					filters={[
						{
							title: "Show",
							paramKey: "show",
							items: PHASES.map((p) => ({
								label: `${p.label} (${data.filter((j) => j.phase === p.value).length})`,
								value: p.value,
							})),
						},
					]}
					actions={<ExportMenu onExport={exportJobCards} disabled={data.length === 0} />}
				/>
			}
		/>
	);
}
