"use client";

import { DataTable } from "@/components/tables";
import { partColumns } from "./partsTable";

/** The parts table while a request loads: real headers, placeholder rows. */
export default function PartsTableSkeleton() {
	return (
		<DataTable
			tableId="parts-loading"
			columns={partColumns(null, () => {})}
			rows={[]}
			loading
		/>
	);
}
