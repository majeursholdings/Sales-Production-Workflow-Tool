import dayjs from "dayjs";
import InventoryPageView from "@/components/pages/inventory";
import { getInventory, getPurchaseOrders, getSupplierCatalog } from "@/lib/data/procurement";
import { getCompanyConfig } from "@/lib/data/companySettings";
import { requireRouteAccess } from "@/lib/session";

export default async function InventoryPage() {
	const user = await requireRouteAccess("/inventory");
	const [inventory, orders, catalog, settings] = await Promise.all([
		getInventory(),
		getPurchaseOrders(),
		getSupplierCatalog(),
		getCompanyConfig(),
	]);
	const poApprovalLimit = settings.tax.poApprovalLimit;
	return (
		<InventoryPageView
			inventory={inventory}
			orders={orders}
			catalog={catalog}
			today={dayjs().format("YYYY-MM-DD")}
			approvalLimit={poApprovalLimit}
			userName={user.name}
		/>
	);
}
