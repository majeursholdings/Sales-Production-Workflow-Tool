import CostRatesPageView from "@/components/pages/costRates";
import { getOverheadInputs } from "@/lib/costRates";
import { requireRouteAccess } from "@/lib/session";

export default async function CostRatesPage() {
	await requireRouteAccess("/cost-rates");
	return <CostRatesPageView overhead={await getOverheadInputs()} />;
}
