import QuotesPageView from "@/components/pages/quotes";
import { getQuotesOverview } from "@/lib/overviews";
import { getQuotes } from "@/lib/quotes";
import { requireRouteAccess } from "@/lib/session";

export default async function QuotesPage() {
	await requireRouteAccess("/quotes");
	const [overview, quotes] = await Promise.all([getQuotesOverview(), getQuotes()]);
	return <QuotesPageView overview={overview} quotes={quotes} />;
}
