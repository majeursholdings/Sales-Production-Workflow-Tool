"use client";

import { DataTable } from "@/components/tables";
import { INVENTORY_TABLE_ID, partColumns } from "./inventoryTable";

/** The inventory table while its data loads: real headers, placeholder rows. Never reads the URL, so it can't suspend itself. */
export default function InventoryTableSkeleton() {
	return (
		<DataTable
			tableId={INVENTORY_TABLE_ID}
			columns={partColumns(() => {})}
			rows={[]}
			loading
			page={1}
			onPageChange={() => {}}
			pagination={{ total: 0, totalPages: 1, rowsPerPage: 10 }}
			toolbar={
				<div
					aria-hidden="true"
					className="flex flex-wrap gap-3 border-b border-line px-5 py-4"
				>
					<div className="h-10 w-72 max-w-full animate-pulse rounded-md bg-subtle" />
					<div className="h-10 w-32 animate-pulse rounded-md bg-subtle" />
					<div className="h-10 w-36 animate-pulse rounded-md bg-subtle" />
					<div className="ml-auto h-10 w-48 animate-pulse rounded-md bg-subtle" />
					<div className="h-10 w-28 animate-pulse rounded-md bg-subtle" />
				</div>
			}
		/>
	);
}
