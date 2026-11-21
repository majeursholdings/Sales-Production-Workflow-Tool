"use client";

import { DataTable } from "@/components/tables";
import { TableHead, teamColumns } from "./teamTable";

/** The people table while its data loads: real headers, placeholder rows. Never reads the URL, so it can't suspend itself. */
export default function TeamTableSkeleton() {
	return (
		<DataTable
			tableId="team"
			columns={teamColumns()}
			rows={[]}
			loading
			page={1}
			onPageChange={() => {}}
			pagination={{ total: 0, totalPages: 1, rowsPerPage: 10 }}
			toolbar={
				<>
					<TableHead />
					<div aria-hidden="true" className="flex gap-3 border-b border-line px-5 py-4">
						<div className="h-10 w-72 max-w-full animate-pulse rounded-md bg-subtle" />
						<div className="ml-auto h-10 w-28 animate-pulse rounded-md bg-subtle" />
					</div>
				</>
			}
		/>
	);
}
