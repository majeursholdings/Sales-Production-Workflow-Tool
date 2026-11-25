import PageWrapper from "@/components/layout/pageWrapper";
import SuppliersPageContent from "@/components/suppliers/suppliersPageContent";
import type { SupplierCatalog } from "@/lib/suppliers";

export default function SuppliersPage({
	catalog,
	today,
}: {
	catalog: SupplierCatalog;
	today: string;
}) {
	return (
		<PageWrapper>
			<SuppliersPageContent catalog={catalog} today={today} />
		</PageWrapper>
	);
}
