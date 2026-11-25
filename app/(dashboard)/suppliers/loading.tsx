import PageTitle from "@/components/layout/pageTitle";
import PageWrapper from "@/components/layout/pageWrapper";
import { suppliersTitle } from "@/components/suppliers/suppliersPageContent";
import SuppliersTableSkeleton from "@/components/suppliers/suppliersTableSkeleton";

/** Shown while the suppliers page fetches its data. */
export default function Loading() {
	return (
		<PageWrapper>
			<PageTitle {...suppliersTitle} />
			<SuppliersTableSkeleton />
		</PageWrapper>
	);
}
