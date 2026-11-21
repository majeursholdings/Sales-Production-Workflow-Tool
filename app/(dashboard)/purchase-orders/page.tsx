import PurchaseOrdersPageView from "@/components/pages/purchaseOrders";
import { requireRouteAccess } from "@/lib/session";

export default async function PurchaseOrdersPage() {
	await requireRouteAccess("/purchase-orders");
	return <PurchaseOrdersPageView />;
}
