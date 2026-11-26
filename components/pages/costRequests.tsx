import CostRequestsPageContent from "@/components/costRequests/costRequestsPageContent";
import PageWrapper from "@/components/layout/pageWrapper";
import type { CostRequest } from "@/lib/costRequests";
import type { Inventory } from "@/lib/inventory";
import type { SupplierCatalog } from "@/lib/suppliers";

export default function CostRequestsPage({
	requests,
	inventory,
	catalog,
	now,
}: {
	requests: CostRequest[];
	inventory: Inventory;
	catalog: SupplierCatalog;
	now: string;
}) {
	return (
		<PageWrapper>
			<CostRequestsPageContent
				requests={requests}
				inventory={inventory}
				catalog={catalog}
				now={now}
			/>
		</PageWrapper>
	);
}
