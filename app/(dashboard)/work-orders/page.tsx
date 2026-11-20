import WorkOrdersPageView from "@/components/pages/workOrders";
import { getJobCardsOverview } from "@/lib/overviews";

export default async function WorkOrdersPage() {
	return <WorkOrdersPageView overview={await getJobCardsOverview()} />;
}
