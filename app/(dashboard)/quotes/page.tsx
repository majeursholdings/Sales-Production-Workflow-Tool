import QuotesPageView from "@/components/pages/quotes";
import { getQuotesOverview } from "@/lib/overviews";
import { getQuotes } from "@/lib/quotes";

export default async function QuotesPage() {
	const [overview, quotes] = await Promise.all([getQuotesOverview(), getQuotes()]);
	return <QuotesPageView overview={overview} quotes={quotes} />;
}
