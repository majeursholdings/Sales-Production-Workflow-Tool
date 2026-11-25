import PageWrapper from "@/components/layout/pageWrapper";
import PurchaseOrdersPageContent from "@/components/purchaseOrders/purchaseOrdersPageContent";
import type { Inventory } from "@/lib/inventory";
import type { PurchaseOrder } from "@/lib/purchaseOrders";
import type { SupplierCatalog } from "@/lib/suppliers";

export default function PurchaseOrdersPage({
	orders,
	inventory,
	catalog,
	today,
	userName,
	canApprove,
}: {
	orders: PurchaseOrder[];
	inventory: Inventory;
	catalog: SupplierCatalog;
	today: string;
	userName: string;
	canApprove: boolean;
}) {
	return (
		<PageWrapper>
			<PurchaseOrdersPageContent
				orders={orders}
				inventory={inventory}
				catalog={catalog}
				today={today}
				userName={userName}
				canApprove={canApprove}
			/>
		</PageWrapper>
	);
}
