import dayjs from "dayjs";
import InventoryPageView from "@/components/pages/inventory";
import { getInventory } from "@/lib/inventory";
import { getPurchaseOrders } from "@/lib/purchaseOrders";
import { requireRouteAccess } from "@/lib/session";
import { getSupplierCatalog } from "@/lib/suppliers";

export default async function InventoryPage() {
	const user = await requireRouteAccess("/inventory");
	const [inventory, orders, catalog] = await Promise.all([
		getInventory(),
		getPurchaseOrders(),
		getSupplierCatalog(),
	]);
	return (
		<InventoryPageView
			inventory={inventory}
			orders={orders}
			catalog={catalog}
			today={dayjs().format("YYYY-MM-DD")}
			userName={user.name}
		/>
	);
}
