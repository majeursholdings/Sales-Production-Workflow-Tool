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
import { formatNaira } from "@/lib/currency";
import { INVOICE_STATUS, type InvoiceRow, type InvoiceStatus } from "@/lib/invoices";

const exportColumns: ExportColumn<InvoiceRow>[] = [
	{ header: "Invoice number", value: (r) => r.id },
	{ header: "Issued", value: (r) => r.issuedLabel },
	{ header: "Client", value: (r) => r.client },
	{ header: "Quote", value: (r) => `${r.quoteNumber} v${r.quoteVersion}` },
	{ header: "Total (₦)", value: (r) => r.total, kind: "money" },
	{ header: "Paid (₦)", value: (r) => r.paid, kind: "money" },
	{ header: "Balance (₦)", value: (r) => r.balance, kind: "money" },
	{ header: "Status", value: (r) => INVOICE_STATUS[r.status].label },
];

export const invoiceColumns: ColumnDef<InvoiceRow>[] = [
	{
		key: "invoice",
		header: "Client and invoice",
		cell: (r) => (
			<span className="flex flex-col">
				<Link
					href={`/invoices/${r.id}`}
					className="font-bold text-fg no-underline hover:underline"
				>
					{r.client}
				</Link>
				<span className="text-small text-fg-tertiary">
					{r.id} · {r.issuedLabel} · from {r.quoteNumber} · v{r.quoteVersion}
				</span>
			</span>
		),
	},
	{
		key: "balance",
		header: "Balance",
		className: "text-end",
		cell: (r) => (
			<span className="flex flex-col items-end">
				<span className="font-bold whitespace-nowrap text-fg tabular">
					{formatNaira(r.balance)}
				</span>
				<span className="text-small whitespace-nowrap text-fg-tertiary tabular">
					Paid {formatNaira(r.paid)} of {formatNaira(r.total)}
				</span>
			</span>
		),
	},
	{
		key: "status",
		header: "Status",
		cell: (r) => (
			<StatusBadge tone={INVOICE_STATUS[r.status].tone}>
				{INVOICE_STATUS[r.status].label}
			</StatusBadge>
		),
	},
	{
		key: "actions",
		header: <span className="sr-only">Actions</span>,
		className: "w-14 text-end",
		cell: (r) => (
			<IconLink href={`/invoices/${r.id}`} aria-label={`Open ${r.id}`} title="View invoice">
				<Eye aria-hidden="true" />
			</IconLink>
		),
	},
];

const STATUS_ORDER: InvoiceStatus[] = ["part", "paid"];

export default function InvoicesTable({ invoices }: { invoices: InvoiceRow[] }) {
	const { rows, pagination } = useTableRows({
		tableId: "invoices",
		data: invoices,
		searchFields: ["client", "id", "quoteNumber"],
		filters: [{ paramKey: "status", field: "status" }],
		sortOptions: [
			{ value: "balance", field: "balance", type: "number", direction: "desc" },
			{ value: "client", field: "client", type: "string", direction: "asc" },
		],
		rowsPerPage: 10,
	});

	const exportInvoices = async (format: ExportFormat) => {
		await exportRows(invoices, exportColumns, {
			format,
			filename: `invoices-${new Date().toISOString().slice(0, 10)}`,
			title: "Invoices",
		});
		toast.success(`Exported ${invoices.length} invoices.`);
	};

	return (
		<DataTable
			tableId="invoices"
			columns={invoiceColumns}
			rows={rows}
			pagination={pagination}
			emptyMessage="No invoices match your search. Try a client, invoice or quote number."
			emptyState={
				invoices.length === 0 ? (
					<TableState
						kind="empty"
						title="No invoices yet"
						description="An invoice is created when Accounting records the deposit on a sent quote."
					/>
				) : undefined
			}
			toolbar={
				<TableToolbar
					search={{ placeholder: "Client, invoice or quote number" }}
					filters={[
						{
							title: "Status",
							paramKey: "status",
							placeholder: `All (${invoices.length})`,
							items: STATUS_ORDER.map((s) => ({
								label: `${INVOICE_STATUS[s].label} (${invoices.filter((r) => r.status === s).length})`,
								value: s,
							})),
						},
					]}
					sortBy={{
						title: "Sort by",
						placeholder: "Newest first",
						items: [
							{ label: "Balance, highest first", value: "balance" },
							{ label: "Client, A to Z", value: "client" },
						],
					}}
					actions={
						<ExportMenu onExport={exportInvoices} disabled={invoices.length === 0} />
					}
				/>
			}
		/>
	);
}
