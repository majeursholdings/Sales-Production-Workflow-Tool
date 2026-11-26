import CostRequestsPageView from "@/components/pages/costRequests";
import { getCostRequests } from "@/lib/data/costRequests";
import { getInventory, getSupplierCatalog } from "@/lib/data/procurement";
import { requireRouteAccess } from "@/lib/session";

export default async function CostRequestsPage() {
	await requireRouteAccess("/cost-requests");
	const [requests, inventory, catalog] = await Promise.all([
		getCostRequests(),
		getInventory(),
		getSupplierCatalog(),
	]);
	return (
		<CostRequestsPageView
			requests={requests}
			inventory={inventory}
			catalog={catalog}
			now={new Date().toISOString()}
		/>
	);
}
