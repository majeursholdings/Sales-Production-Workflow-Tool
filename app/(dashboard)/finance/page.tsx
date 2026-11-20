import FinancePageView from "@/components/pages/finance";
import { getFinanceOverview } from "@/lib/overviews";

export default async function FinancePage() {
	return <FinancePageView overview={await getFinanceOverview()} />;
}
