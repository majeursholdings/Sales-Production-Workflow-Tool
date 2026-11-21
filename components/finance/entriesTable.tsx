"use client";

import dayjs from "dayjs";
import { Eye } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/common/badge";
import {
	DataTable,
	ExportMenu,
	IconLink,
	TableToolbar,
	exportRows,
	useTableRows,
	type ColumnDef,
	type ExportColumn,
	type ExportFormat,
} from "@/components/tables";
import { CATEGORY_LABELS, EXPENSE_CATEGORIES, INCOME_CATEGORIES, naira } from "@/lib/finance";
import type { FinanceEntry } from "@/lib/finance";

export type EntryRow = FinanceEntry & { categoryLabel: string };

/** Columns for the entries table. Needs nothing from the page, so the loading skeleton uses it as is. */
export function entryColumns(): ColumnDef<EntryRow>[] {
	return [
		{
			key: "date",
			header: "Date",
			className: "whitespace-nowrap",
			cell: (e) => dayjs(e.date).format("D MMM YYYY"),
		},
		{
			key: "entry",
			header: "Entry",
			cell: (e) => (
				<span className="flex min-w-0 flex-col">
					<span className="font-bold text-fg">{e.description}</span>
					<span className="text-small text-fg-tertiary">
						{e.reference} · {e.recordedBy}
					</span>
				</span>
			),
		},
		{
			key: "category",
			header: "Category",
			cell: (e) => (
				<Badge variant={e.kind === "in" ? "success" : "neutral"}>{e.categoryLabel}</Badge>
			),
		},
		{
			key: "amount",
			header: "Amount",
			className: "text-end whitespace-nowrap tabular",
			cell: (e) => (
				<span className={e.kind === "in" ? "font-bold text-success-fg" : "text-fg"}>
					{e.kind === "in" ? "+" : "−"}
					{naira(e.amount)}
				</span>
			),
		},
		{
			key: "actions",
			header: <span className="sr-only">Actions</span>,
			className: "w-14 text-end",
			cell: (e) =>
				e.href ? (
					<IconLink
						href={e.href}
						aria-label={`Open the ${e.kind === "in" ? "invoice" : "purchase order"} for ${e.description}`}
						title={e.kind === "in" ? "Open invoice" : "Open purchase order"}
					>
						<Eye aria-hidden="true" />
					</IconLink>
				) : null,
		},
	];
}

const exportColumns: ExportColumn<EntryRow>[] = [
	{ header: "Date", value: (e) => new Date(e.date), kind: "date" },
	{ header: "Type", value: (e) => (e.kind === "in" ? "Money in" : "Money out") },
	{ header: "Entry", value: (e) => e.description },
	{ header: "Category", value: (e) => e.categoryLabel },
	{ header: "Reference", value: (e) => e.reference },
	{
		header: "Amount (₦, VAT incl.)",
		value: (e) => (e.kind === "in" ? e.amount : -e.amount),
		kind: "money",
	},
];

/** Saves the entries as a file in the chosen format. Also used by the page's "Download report". */
export async function exportEntries(
	entries: EntryRow[],
	format: ExportFormat,
	title: string,
	filename: string,
) {
	await exportRows(entries, exportColumns, { format, filename, title });
	toast.success(`Exported ${entries.length} ${entries.length === 1 ? "entry" : "entries"}.`);
}

export const toEntryRows = (entries: FinanceEntry[]): EntryRow[] =>
	entries.map((e) => ({ ...e, categoryLabel: CATEGORY_LABELS[e.category] }));

/** The "Entries" heading row at the top of the table's card. */
export function EntriesHead({ count }: { count?: number }) {
	return (
		<div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
			<h2 className="flex-1">Entries</h2>
			{count !== undefined && (
				<span className="text-small text-fg-tertiary">
					{count} {count === 1 ? "entry" : "entries"}
				</span>
			)}
		</div>
	);
}

export default function EntriesTable({
	entries,
	rangeText,
	exportName,
}: {
	/** Entries in the chosen period, newest first. */
	entries: FinanceEntry[];
	rangeText: string;
	exportName: string;
}) {
	const data = toEntryRows(entries);

	const { rows, pagination } = useTableRows({
		tableId: "entries",
		data,
		searchFields: ["description", "reference", "categoryLabel"],
		filters: [
			{ paramKey: "type", field: "kind" },
			{ paramKey: "category", field: "category" },
		],
		sortOptions: [
			{ value: "old", field: "date", type: "date", direction: "asc" },
			{ value: "big", field: "amount", type: "number", direction: "desc" },
		],
		rowsPerPage: 10,
	});

	const count = (kind: "in" | "out") => data.filter((e) => e.kind === kind).length;

	return (
		<DataTable
			tableId="entries"
			columns={entryColumns()}
			rows={rows}
			pagination={pagination}
			emptyMessage={`No entries match these filters in ${rangeText}.`}
			toolbar={
				<>
					<EntriesHead count={data.length} />
					<TableToolbar
						search={{ placeholder: "Client, supplier or reference" }}
						filters={[
							{
								title: "Type",
								paramKey: "type",
								items: [
									{ label: `Money in (${count("in")})`, value: "in" },
									{ label: `Money out (${count("out")})`, value: "out" },
								],
							},
							{
								title: "Category",
								paramKey: "category",
								placeholder: "All categories",
								items: [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES].map((c) => ({
									label: CATEGORY_LABELS[c],
									value: c,
								})),
							},
						]}
						sortBy={{
							title: "Sort by",
							placeholder: "Newest first",
							items: [
								{ label: "Oldest first", value: "old" },
								{ label: "Largest amount", value: "big" },
							],
						}}
						actions={
							<ExportMenu
								disabled={data.length === 0}
								onExport={(format) =>
									exportEntries(data, format, "Revenue & expenses", exportName)
								}
							/>
						}
					/>
				</>
			}
		/>
	);
}
