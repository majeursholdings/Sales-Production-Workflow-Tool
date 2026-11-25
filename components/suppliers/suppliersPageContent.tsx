"use client";

import { Suspense, useState } from "react";
import dayjs from "dayjs";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/common/buttons";
import PageTitle from "@/components/layout/pageTitle";
import { supplierId, type SupplierCatalog } from "@/lib/suppliers";
import SupplierDrawer, { type SupplierDetails } from "./supplierDrawer";
import SuppliersTable from "./suppliersTable";
import SuppliersTableSkeleton from "./suppliersTableSkeleton";

export const suppliersTitle = {
	pageTitle: "Suppliers",
	pageDescription:
		"Who we buy each material from. Several suppliers can supply the same material; procurement rates each one per material.",
};

/** The page title (with "Add supplier") and the table both depend on the supplier list, so they live together here. */
export default function SuppliersPageContent({
	initialCatalog,
	today,
}: {
	initialCatalog: SupplierCatalog;
	today: string;
}) {
	const [catalog, setCatalog] = useState(initialCatalog);
	const [adding, setAdding] = useState(false);

	const add = (details: SupplierDetails) => {
		const id = supplierId(details.business, new Set(catalog.suppliers.map((s) => s.id)));
		setCatalog((c) => ({
			...c,
			suppliers: [
				...c.suppliers,
				{
					...details,
					id,
					area: details.address.split(",").slice(-2).join(",").trim(),
					since: dayjs(today).format("MMM YYYY"),
					onTimePercent: 0,
					deliveries: 0,
					paidThisYear: 0,
					materials: [],
					purchaseOrders: [],
				},
			],
		}));
		setAdding(false);
		toast.success(`${details.business} added. Add the materials they supply on their page.`);
	};

	return (
		<>
			<PageTitle
				{...suppliersTitle}
				actions={
					<Button variant="primary" onClick={() => setAdding(true)}>
						<Plus />
						Add supplier
					</Button>
				}
			/>
			{/* the table keeps its search, filter, sort and page in the URL, which needs Suspense on a static page */}
			<Suspense fallback={<SuppliersTableSkeleton />}>
				<SuppliersTable catalog={catalog} today={today} />
			</Suspense>

			{adding && <SupplierDrawer onSave={add} onClose={() => setAdding(false)} />}
		</>
	);
}
