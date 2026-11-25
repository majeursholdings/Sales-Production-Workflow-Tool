"use client";

import type { ReactNode } from "react";
import { DataTable, StatusBadge, TableState, type ColumnDef } from "@/components/tables";
import { wholeNaira } from "@/lib/quoteBuilder";
import { PO_STATUS, dateLabel, type SupplierPurchaseOrder } from "@/lib/suppliers";

type OrderRow = SupplierPurchaseOrder & { id: string };

export const orderColumns: ColumnDef<OrderRow>[] = [
	{
		key: "number",
		header: "Purchase order",
		cell: (po) => (
			<span className="flex flex-col">
				<span className="font-bold whitespace-nowrap text-fg">{po.number}</span>
				<span className="text-small text-fg-tertiary">{dateLabel(po.date)}</span>
			</span>
		),
	},
	{ key: "items", header: "Items", cell: (po) => po.items },
	{
		key: "total",
		header: "Total",
		className: "text-end",
		cell: (po) => (
			<span className="font-bold whitespace-nowrap text-fg tabular">
				{wholeNaira(po.total)}
			</span>
		),
	},
	{
		key: "status",
		header: "Status",
		cell: (po) => (
			<span className="flex flex-col items-start gap-1">
				<StatusBadge tone={PO_STATUS[po.status].tone}>
					{PO_STATUS[po.status].label}
				</StatusBadge>
				<span className="text-small whitespace-nowrap text-fg-tertiary">{po.note}</span>
			</span>
		),
	},
];

/** A supplier's latest purchase orders. A short list, so no paging. */
export default function SupplierOrdersTable({
	orders,
	header,
}: {
	orders: SupplierPurchaseOrder[];
	header: ReactNode;
}) {
	return (
		<DataTable
			tableId="supplier-orders"
			columns={orderColumns}
			rows={orders.slice(0, 5).map((po) => ({ ...po, id: po.number }))}
			toolbar={header}
			emptyState={
				<TableState
					kind="empty"
					title="No purchase orders yet"
					description="Orders placed with this supplier show up here."
				/>
			}
		/>
	);
}
