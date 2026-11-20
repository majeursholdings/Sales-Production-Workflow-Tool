import CostRatesPageView from "@/components/pages/costRates";
import { getOverheadInputs } from "@/lib/costRates";

export default async function CostRatesPage() {
	return <CostRatesPageView overhead={await getOverheadInputs()} />;
}
