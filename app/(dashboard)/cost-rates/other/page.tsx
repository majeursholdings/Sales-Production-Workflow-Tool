import CostRatesOtherPageView from "@/components/pages/costRatesOther";
import { getContingency, getCostItems } from "@/lib/costRates";

export default async function CostRatesOtherPage() {
	const [items, contingency] = await Promise.all([getCostItems(), getContingency()]);
	return <CostRatesOtherPageView items={items} contingency={contingency} />;
}
