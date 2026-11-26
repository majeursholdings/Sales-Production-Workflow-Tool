import InventoryPageContent from "@/components/inventory/inventoryPageContent";
import PageWrapper from "@/components/layout/pageWrapper";
import type { Inventory } from "@/lib/inventory";
import type { PurchaseOrder } from "@/lib/purchaseOrders";
import type { SupplierCatalog } from "@/lib/suppliers";

export default function InventoryPage({
	inventory,
	orders,
	catalog,
	today,
	userName,
	approvalLimit,
}: {
	inventory: Inventory;
	orders: PurchaseOrder[];
	catalog: SupplierCatalog;
	today: string;
	userName: string;
	approvalLimit: number;
}) {
	return (
		<PageWrapper>
			<InventoryPageContent
				inventory={inventory}
				orders={orders}
				catalog={catalog}
				today={today}
				userName={userName}
				approvalLimit={approvalLimit}
			/>
		</PageWrapper>
	);
}
