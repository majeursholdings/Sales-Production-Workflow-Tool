import FinancePageView from "@/components/pages/finance";
import { getFinanceOverview } from "@/lib/overviews";
import { requireRouteAccess } from "@/lib/session";

export default async function FinancePage() {
	await requireRouteAccess("/finance");
	return <FinancePageView overview={await getFinanceOverview()} />;
}
