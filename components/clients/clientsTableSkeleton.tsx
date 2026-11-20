"use client";

import { DataTable } from "@/components/tables";
import { clientColumns } from "./clientsTable";

/**
 * The clients table while its data loads: real headers, placeholder rows.
 * `page` and `onPageChange` are set so it never reads the URL (which would
 * suspend the fallback itself).
 */
export default function ClientsTableSkeleton() {
	return (
		<DataTable
			tableId="clients"
			columns={clientColumns}
			rows={[]}
			loading
			page={1}
			onPageChange={() => {}}
			pagination={{ total: 0, totalPages: 1, rowsPerPage: 10 }}
			toolbar={
				<div aria-hidden="true" className="flex gap-3 border-b border-line px-5 py-4">
					<div className="h-10 w-72 max-w-full animate-pulse rounded-md bg-subtle" />
					<div className="ml-auto h-10 w-40 animate-pulse rounded-md bg-subtle" />
				</div>
			}
		/>
	);
}
