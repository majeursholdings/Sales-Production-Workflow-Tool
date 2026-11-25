import InventoryPageContent from "@/components/inventory/inventoryPageContent";
import PageWrapper from "@/components/layout/pageWrapper";
import type { Inventory } from "@/lib/inventory";
import type { SupplierCatalog } from "@/lib/suppliers";

export default function InventoryPage({
	inventory,
	catalog,
	today,
}: {
	inventory: Inventory;
	catalog: SupplierCatalog;
	today: string;
}) {
	return (
		<PageWrapper>
			<InventoryPageContent initialInventory={inventory} catalog={catalog} today={today} />
		</PageWrapper>
	);
}
