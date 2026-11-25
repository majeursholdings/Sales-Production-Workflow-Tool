import PageTitle from "@/components/layout/pageTitle";
import PageWrapper from "@/components/layout/pageWrapper";
import { purchaseOrdersTitle } from "@/components/purchaseOrders/purchaseOrdersPageContent";
import PurchaseOrdersTableSkeleton from "@/components/purchaseOrders/purchaseOrdersTableSkeleton";

/** Shown while the purchase orders page fetches its data. */
export default function Loading() {
	return (
		<PageWrapper>
			<PageTitle {...purchaseOrdersTitle} />
			<PurchaseOrdersTableSkeleton />
		</PageWrapper>
	);
}
