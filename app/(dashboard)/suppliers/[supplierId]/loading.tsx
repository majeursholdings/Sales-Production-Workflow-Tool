import PageWrapper from "@/components/layout/pageWrapper";
import SupplierDetailSkeleton from "@/components/suppliers/supplierDetailSkeleton";

/** Shown while a supplier's page fetches its data. */
export default function Loading() {
	return (
		<PageWrapper>
			<SupplierDetailSkeleton />
		</PageWrapper>
	);
}
