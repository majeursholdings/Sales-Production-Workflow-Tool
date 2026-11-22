"use client";

import { DataTable } from "@/components/tables";
import { maintenanceColumns } from "./maintenanceTable";

/** The maintenance history while it loads: real headers, placeholder rows. Never reads the URL, so it can't suspend itself. */
export default function MaintenanceTableSkeleton() {
	return (
		<DataTable
			tableId="maintenance"
			columns={maintenanceColumns({ canDelete: true })}
			rows={[]}
			loading
			page={1}
			onPageChange={() => {}}
			pagination={{ total: 0, totalPages: 1, rowsPerPage: 10 }}
			toolbar={
				<div aria-hidden="true" className="flex gap-3 border-b border-line px-5 py-4">
					<div className="h-10 w-40 animate-pulse rounded-md bg-subtle" />
				</div>
			}
		/>
	);
}
