import dayjs from "dayjs";
import InventoryPageView from "@/components/pages/inventory";
import { getInventory, getPurchaseOrders, getSupplierCatalog } from "@/lib/data/procurement";
import { getCompanySettings } from "@/lib/data/companySettings";
import { requireRouteAccess } from "@/lib/session";

export default async function InventoryPage() {
	const user = await requireRouteAccess("/inventory");
	const [inventory, orders, catalog] = await Promise.all([
		getInventory(),
		getPurchaseOrders(),
		getSupplierCatalog(),
	]);
	const poApprovalLimit = (await getCompanySettings()).tax.poApprovalLimit;
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
