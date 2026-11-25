import dayjs from "dayjs";
import { notFound } from "next/navigation";
import PageWrapper from "@/components/layout/pageWrapper";
import SupplierDetailView from "@/components/suppliers/supplierDetailView";
import { getSupplierCatalog, sampleSupplierIds } from "@/lib/suppliers";
import { requireRouteAccess } from "@/lib/session";

export function generateStaticParams() {
	return sampleSupplierIds.map((supplierId) => ({ supplierId }));
}

export default async function SupplierPage({ params }: PageProps<"/suppliers/[supplierId]">) {
	const user = await requireRouteAccess("/suppliers");
	const { supplierId } = await params;
	const catalog = await getSupplierCatalog();
	if (!catalog.suppliers.some((s) => s.id === supplierId)) notFound();
	return (
		<PageWrapper>
			<SupplierDetailView
				// a different supplier is a fresh page, with its own edits
				key={supplierId}
				initialCatalog={catalog}
				supplierId={supplierId}
				today={dayjs().format("YYYY-MM-DD")}
				viewerName={user.name}
			/>
		</PageWrapper>
	);
}
