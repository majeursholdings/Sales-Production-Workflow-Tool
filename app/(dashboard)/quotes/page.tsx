import QuotesPageView from "@/components/pages/quotes";
import { getQuotesOverview } from "@/lib/overviews";

export default async function QuotesPage() {
	return <QuotesPageView overview={await getQuotesOverview()} />;
}
