import WorkOrdersPageView from "@/components/pages/workOrders";
import { getJobCardsOverview } from "@/lib/overviews";
import { requireRouteAccess } from "@/lib/session";

export default async function WorkOrdersPage() {
	await requireRouteAccess("/work-orders");
	return <WorkOrdersPageView overview={await getJobCardsOverview()} />;
}
