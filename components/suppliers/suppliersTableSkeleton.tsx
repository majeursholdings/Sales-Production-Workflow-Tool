"use client";

import { DataTable } from "@/components/tables";
import { supplierColumns } from "./suppliersTable";

/** The suppliers table while its data loads: real headers, placeholder rows. Never reads the URL, so it can't suspend itself. */
export default function SuppliersTableSkeleton() {
	return (
		<DataTable
			tableId="suppliers"
			columns={supplierColumns}
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
					<div className="h-10 w-40 animate-pulse rounded-md bg-subtle" />
					<div className="ml-auto h-10 w-48 animate-pulse rounded-md bg-subtle" />
					<div className="h-10 w-28 animate-pulse rounded-md bg-subtle" />
				</div>
			}
		/>
	);
}
