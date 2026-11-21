import CostRatesOtherPageView from "@/components/pages/costRatesOther";
import { getContingency, getCostItems } from "@/lib/costRates";
import { requireRouteAccess } from "@/lib/session";

export default async function CostRatesOtherPage() {
	await requireRouteAccess("/cost-rates/other");
	const [items, contingency] = await Promise.all([getCostItems(), getContingency()]);
	return <CostRatesOtherPageView items={items} contingency={contingency} />;
}
