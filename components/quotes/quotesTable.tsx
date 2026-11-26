"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteDraftQuoteAction } from "@/app/(dashboard)/quotes/actions";
import { ConfirmDialog } from "@/components/common/modal";
import {
	DataTable,
	ExportMenu,
	StatusBadge,
	TableToolbar,
	exportRows,
	useTableRows,
	type ColumnDef,
	type ExportColumn,
	type ExportFormat,
} from "@/components/tables";
import { formatNaira } from "@/lib/currency";
import { QUOTE_STATUS, type Quote, type QuoteStatus } from "@/lib/quotes";

const exportColumns: ExportColumn<Quote>[] = [
	{ header: "Quote number", value: (r) => r.id },
	{ header: "Client", value: (r) => r.client },
	{ header: "Items", value: (r) => r.items },
	{ header: "Total (₦)", value: (r) => r.total, kind: "money" },
	{ header: "Status", value: (r) => QUOTE_STATUS[r.status].label },
	{ header: "Valid until", value: (r) => r.validUntilLabel },
	{ header: "Created by", value: (r) => r.createdBy },
];

export const quoteColumns: ColumnDef<Quote>[] = [
	{
		key: "quote",
		header: "Client and quote",
		cell: (r) => (
			<span className="flex flex-col">
				<Link
					href={`/quotes/${r.id}`}
					className="font-bold text-fg no-underline hover:underline"
				>
					{r.client}
				</Link>
				<span className="text-small text-fg-tertiary">
					{r.id} · {r.version} · {r.items}
				</span>
			</span>
		),
	},
	{
		key: "total",
		header: "Total",
		className: "text-end",
		cell: (r) => (
			<span className="font-bold whitespace-nowrap text-fg tabular">
				{formatNaira(r.total)}
			</span>
		),
	},
	{
		key: "status",
		header: "Status",
		cell: (r) => (
			<span className="flex flex-col items-start gap-1">
				<StatusBadge tone={QUOTE_STATUS[r.status].tone}>
					{QUOTE_STATUS[r.status].label}
				</StatusBadge>
				<span className="text-small whitespace-nowrap text-fg-tertiary">
					Valid until {r.validUntilLabel} · {r.createdBy}
				</span>
			</span>
		),
	},
];

const STATUS_ORDER: QuoteStatus[] = ["draft", "sent", "expiring", "paid", "expired", "cancelled"];

export default function QuotesTable({ initialQuotes }: { initialQuotes: Quote[] }) {
	const router = useRouter();
	const [deleting, setDeleting] = useState<Quote | null>(null);
	const [busy, startTransition] = useTransition();
	const quotes = initialQuotes;

	const { rows, pagination } = useTableRows({
		tableId: "quotes",
		data: quotes,
		searchFields: ["client", "id"],
		filters: [{ paramKey: "status", field: "status" }],
		sortOptions: [
			{ value: "total", field: "total", type: "number", direction: "desc" },
			{ value: "valid", field: "validUntil", type: "date", direction: "asc" },
		],
		rowsPerPage: 10,
	});

	const exportQuotes = async (format: ExportFormat) => {
		await exportRows(quotes, exportColumns, {
			format,
			filename: `quotes-${new Date().toISOString().slice(0, 10)}`,
			title: "Quotes",
		});
		toast.success(`Exported ${quotes.length} quotes.`);
	};

	return (
		<>
			<DataTable
				tableId="quotes"
				columns={quoteColumns}
				rows={rows}
				pagination={pagination}
				emptyMessage="No quotes with this status. Choose another filter or start a new quote."
				viewAction={{ type: "link", href: (r) => `/quotes/${r.id}` }}
				rowActions={[
					{
						label: "Delete draft",
						icon: <Trash2 aria-hidden="true" />,
						tone: "danger",
						hidden: (r) => r.status !== "draft",
						onSelect: setDeleting,
					},
				]}
				toolbar={
					<TableToolbar
						search={{ placeholder: "Client or quote number" }}
						filters={[
							{
								title: "Status",
								paramKey: "status",
								items: STATUS_ORDER.map((s) => ({
									label: `${QUOTE_STATUS[s].label} (${quotes.filter((r) => r.status === s).length})`,
									value: s,
								})),
							},
						]}
						sortBy={{
							title: "Sort by",
							placeholder: "Newest first",
							items: [
								{ label: "Total, highest first", value: "total" },
								{ label: "Valid until, soonest first", value: "valid" },
							],
						}}
						actions={
							<ExportMenu onExport={exportQuotes} disabled={quotes.length === 0} />
						}
					/>
				}
			/>
			{deleting && (
				<ConfirmDialog
					title={`Delete draft ${deleting.id}?`}
					confirmLabel={busy ? "Deleting…" : "Delete draft"}
					onCancel={() => !busy && setDeleting(null)}
					onConfirm={() => {
						const target = deleting;
						startTransition(async () => {
							const res = await deleteDraftQuoteAction(target.id);
							if (!res.ok) {
								toast.error(res.message);
								return;
							}
							toast.success(`Draft ${target.id} deleted.`);
							setDeleting(null);
							router.refresh();
						});
					}}
				>
					The draft for {deleting.client} and its items will be removed. It was never
					sent, so the client won&apos;t notice. This can&apos;t be undone.
				</ConfirmDialog>
			)}
		</>
	);
}
