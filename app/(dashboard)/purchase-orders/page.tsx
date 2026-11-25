import dayjs from "dayjs";
import PurchaseOrdersPageView from "@/components/pages/purchaseOrders";
import { getInventory } from "@/lib/inventory";
import { getPurchaseOrders } from "@/lib/purchaseOrders";
import { requireRouteAccess } from "@/lib/session";
import { getSupplierCatalog } from "@/lib/suppliers";

export default async function PurchaseOrdersPage() {
	const user = await requireRouteAccess("/purchase-orders");
	const [orders, inventory, catalog] = await Promise.all([
		getPurchaseOrders(),
		getInventory(),
		getSupplierCatalog(),
	]);
	return (
		<PurchaseOrdersPageView
			orders={orders}
			inventory={inventory}
			catalog={catalog}
			today={dayjs().format("YYYY-MM-DD")}
			userName={user.name}
			canApprove={user.roleKey === "md" || user.roleKey === "gm"}
		/>
	);
}
