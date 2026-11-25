import dayjs from "dayjs";
import PurchaseOrdersPageView from "@/components/pages/purchaseOrders";
import { getInventory, getPurchaseOrders, getSupplierCatalog } from "@/lib/data/procurement";
import { getCompanySettings } from "@/lib/data/companySettings";
import { requireRouteAccess } from "@/lib/session";

export default async function PurchaseOrdersPage() {
	const user = await requireRouteAccess("/purchase-orders");
	const [orders, inventory, catalog] = await Promise.all([
		getPurchaseOrders(),
		getInventory(),
		getSupplierCatalog(),
	]);
	const poApprovalLimit = (await getCompanySettings()).tax.poApprovalLimit;
	return (
		<PurchaseOrdersPageView
			orders={orders}
			inventory={inventory}
			catalog={catalog}
			today={dayjs().format("YYYY-MM-DD")}
			userName={user.name}
			approvalLimit={poApprovalLimit}
			canApprove={user.roleKey === "md" || user.roleKey === "gm"}
		/>
	);
}
