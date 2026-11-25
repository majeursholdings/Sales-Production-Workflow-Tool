import dayjs from "dayjs";
import CostRequestsPageView from "@/components/pages/costRequests";
import { getCostRequests } from "@/lib/costRequests";
import { getInventory } from "@/lib/inventory";
import { requireRouteAccess } from "@/lib/session";
import { getSupplierCatalog } from "@/lib/suppliers";

export default async function CostRequestsPage() {
	const user = await requireRouteAccess("/cost-requests");
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
			now={dayjs().format("YYYY-MM-DDTHH:mm:ss")}
			userName={user.name}
		/>
	);
}
