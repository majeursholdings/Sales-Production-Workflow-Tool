"use client";

import { CardHeader } from "@/components/common/card";
import { DataTable } from "@/components/tables";
import { materialColumns } from "./supplierMaterialsTable";
import { orderColumns } from "./supplierOrdersTable";

const header = (title: string) => (
	<CardHeader>
		<h2 className="flex-1">{title}</h2>
	</CardHeader>
);

/** A supplier's page while it loads: the real table headers with placeholder rows, and blocks for the rest. */
export default function SupplierDetailSkeleton() {
	return (
		<>
			<div aria-hidden="true" className="flex flex-col gap-3">
				<div className="h-4 w-40 animate-pulse rounded-sm bg-subtle" />
				<div className="h-8 w-64 animate-pulse rounded-md bg-subtle" />
			</div>
			<div aria-hidden="true" className="h-24 animate-pulse rounded-lg bg-subtle" />
			<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)] lg:items-start">
				<div className="flex min-w-0 flex-col gap-6">
					<DataTable
						tableId="supplier-materials"
						columns={materialColumns()}
						rows={[]}
						loading
						toolbar={header("Materials supplied")}
					/>
					<DataTable
						tableId="supplier-orders"
						columns={orderColumns}
						rows={[]}
						loading
						toolbar={header("Recent purchase orders")}
					/>
				</div>
				<div aria-hidden="true" className="flex flex-col gap-6">
					<div className="h-44 animate-pulse rounded-lg bg-subtle" />
					<div className="h-44 animate-pulse rounded-lg bg-subtle" />
					<div className="h-28 animate-pulse rounded-lg bg-subtle" />
				</div>
			</div>
		</>
	);
}
