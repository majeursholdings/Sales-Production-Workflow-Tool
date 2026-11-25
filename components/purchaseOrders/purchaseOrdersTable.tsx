"use client";

import { Eye } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/common/badge";
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
import {
	PO_STATUS,
	STATUS_GROUP,
	deliveryNote,
	money,
	poDate,
	poItems,
	poTotal,
	type PurchaseOrder,
} from "@/lib/purchaseOrders";
import type { SupplierCatalog } from "@/lib/suppliers";

export const PO_TABLE_ID = "purchaseOrders";

/** A row in the purchase orders table: the order with the figures the table filters and sorts on. */
export type PORow = PurchaseOrder & {
	id: string;
	supplierName: string;
	total: number;
	items: string;
	group: string;
	searchText: string;
};

export function toPORows(orders: PurchaseOrder[], catalog: SupplierCatalog): PORow[] {
	return orders
		.map((po) => {
			const supplierName =
				catalog.suppliers.find((s) => s.id === po.supplierId)?.business ??
				(po.supplierName || "Unknown supplier");
			return {
				...po,
				id: po.number,
				supplierName,
				total: poTotal(po),
				items: poItems(po),
				group: STATUS_GROUP[po.status],
				searchText: [
					po.number,
					supplierName,
					...po.lines.map((l) => `${l.name} ${l.sku}`),
				].join(" "),
			};
		})
		.sort((a, b) => b.number.localeCompare(a.number));
}

/** The table's columns. `onOpen` opens an order's drawer. */
export function poColumns(onOpen: (row: PORow) => void): ColumnDef<PORow>[] {
	return [
		{
			key: "number",
			header: "Purchase order",
			cell: (po) => (
				<span className="flex min-w-48 flex-col">
					<button
						type="button"
						onClick={() => onOpen(po)}
						className="cursor-pointer text-start font-bold text-fg hover:underline"
					>
						{po.number}
					</button>
					<span className="text-small text-fg-tertiary">
						{poDate(po.date)} · by {po.raisedBy}
					</span>
				</span>
			),
		},
		{
			key: "supplier",
			header: "Supplier",
			cell: (po) => (
				<span className="flex max-w-80 min-w-48 flex-col">
					<strong className="text-fg">{po.supplierName}</strong>
					<span className="text-small text-fg-tertiary">{po.items}</span>
				</span>
			),
		},
		{
			key: "total",
			header: "Total",
			className: "text-end",
			cell: (po) => (
				<strong className="whitespace-nowrap text-fg tabular">{money(po.total)}</strong>
			),
		},
		{
			key: "status",
			header: "Status",
			cell: (po) => (
				<span className="flex flex-col items-start gap-1">
					<Badge variant={PO_STATUS[po.status].tone}>{PO_STATUS[po.status].label}</Badge>
					<span className="text-small whitespace-nowrap text-fg-tertiary">
						{deliveryNote(po)}
					</span>
				</span>
			),
		},
		{
			key: "actions",
			header: <span className="sr-only">Actions</span>,
			className: "w-14 text-end",
			cell: (po) => (
				<IconButton
					aria-label={`Open ${po.number}`}
					title="View purchase order"
					onClick={() => onOpen(po)}
				>
					<Eye aria-hidden="true" />
				</IconButton>
			),
		},
	];
}

export default function PurchaseOrdersTable({
	data,
	today,
	onOpen,
}: {
	data: PORow[];
	today: string;
	onOpen: (row: PORow) => void;
}) {
	const { rows, pagination } = useTableRows({
		tableId: PO_TABLE_ID,
		data,
		searchFields: ["searchText"],
		filters: [{ paramKey: "status", field: "group" }],
		sortOptions: [
			{ value: "total", field: "total", type: "number", direction: "desc" },
			{ value: "supplier", field: "supplierName" },
		],
		rowsPerPage: 10,
	});

	const exportColumns: ExportColumn<PORow>[] = [
		{ header: "PO number", value: (po) => po.number },
		{ header: "Date", value: (po) => new Date(po.date), kind: "date" },
		{ header: "Raised by", value: (po) => po.raisedBy, skipInPdf: true },
		{ header: "Supplier", value: (po) => po.supplierName },
		{ header: "Items", value: (po) => po.items },
		{ header: "Total (₦)", value: (po) => po.total, kind: "money" },
		{ header: "Status", value: (po) => PO_STATUS[po.status].label },
		{ header: "Delivery", value: (po) => deliveryNote(po) },
		{ header: "Job card", value: (po) => po.jobCard ?? "Restock", skipInPdf: true },
	];

	const exportOrders = async (format: ExportFormat) => {
		await exportRows(data, exportColumns, {
			format,
			filename: `purchase-orders-${today}`,
			title: "Purchase orders",
		});
		toast.success(`Exported ${data.length} purchase orders.`);
	};

	const count = (group: string) => data.filter((po) => po.group === group).length;

	return (
		<DataTable
			tableId={PO_TABLE_ID}
			columns={poColumns(onOpen)}
			rows={rows}
			pagination={pagination}
			emptyMessage="No purchase orders match. Try a PO number, supplier or part, or clear the filter."
			toolbar={
				<TableToolbar
					search={{ placeholder: "PO number, supplier or part" }}
					filters={[
						{
							title: "Status",
							paramKey: "status",
							items: [
								{ label: `Drafts & approval (${count("draft")})`, value: "draft" },
								{ label: `Awaiting delivery (${count("open")})`, value: "open" },
								{ label: `Received (${count("received")})`, value: "received" },
							],
						},
					]}
					sortBy={{
						title: "Sort by",
						placeholder: "Newest first",
						items: [
							{ label: "Total, highest first", value: "total" },
							{ label: "Supplier, A to Z", value: "supplier" },
						],
					}}
					actions={<ExportMenu onExport={exportOrders} disabled={data.length === 0} />}
				/>
			}
		/>
	);
}
