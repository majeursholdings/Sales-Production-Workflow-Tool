import { notFound } from "next/navigation";
import PageWrapper from "@/components/layout/pageWrapper";
import SupplierDetailView from "@/components/suppliers/supplierDetailView";
import { getSupplierCatalog } from "@/lib/data/procurement";
import { requireRouteAccess } from "@/lib/session";

export default async function SupplierPage({ params }: PageProps<"/suppliers/[supplierId]">) {
	await requireRouteAccess("/suppliers");
	const { supplierId } = await params;
	const catalog = await getSupplierCatalog();
	if (!catalog.suppliers.some((s) => s.id === supplierId)) notFound();
	return (
		<PageWrapper>
			<SupplierDetailView
				catalog={catalog}
				supplierId={supplierId}
			/>
		</PageWrapper>
	);
}
