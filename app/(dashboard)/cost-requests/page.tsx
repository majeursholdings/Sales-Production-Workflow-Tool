import CostRequestsPageView from "@/components/pages/costRequests";
import { requireRouteAccess } from "@/lib/session";

export default async function CostRequestsPage() {
	await requireRouteAccess("/cost-requests");
	return <CostRequestsPageView />;
}
