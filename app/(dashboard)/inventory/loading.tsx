import { inventoryTitle } from "@/components/inventory/inventoryPageContent";
import InventoryTableSkeleton from "@/components/inventory/inventoryTableSkeleton";
import PageTitle from "@/components/layout/pageTitle";
import PageWrapper from "@/components/layout/pageWrapper";

/** Shown while the inventory page fetches its data. */
export default function Loading() {
	return (
		<PageWrapper>
			<PageTitle {...inventoryTitle} />
			<InventoryTableSkeleton />
		</PageWrapper>
	);
}
