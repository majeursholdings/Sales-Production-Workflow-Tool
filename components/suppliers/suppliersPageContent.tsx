"use client";

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/common/buttons";
import PageTitle from "@/components/layout/pageTitle";
import { createSupplierAction } from "@/app/(dashboard)/suppliers/actions";
import type { SupplierCatalog } from "@/lib/suppliers";
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
	catalog,
	today,
}: {
	catalog: SupplierCatalog;
	today: string;
}) {
	const router = useRouter();
	const [adding, setAdding] = useState(false);

	const add = async (details: SupplierDetails) => {
		const result = await createSupplierAction(details);
		if (!result.ok) {
			toast.error(result.message);
			return;
		}
		setAdding(false);
		toast.success(`${details.business} added. Add the materials they supply on their page.`, {
			action: { label: "Open", onClick: () => router.push(`/suppliers/${result.data.id}`) },
		});
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
