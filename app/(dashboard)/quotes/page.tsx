import QuotesPageView from "@/components/pages/quotes";
import { getQuotes, getQuotesOverview } from "@/lib/data/quotes";
import { requireRouteAccess } from "@/lib/session";

export default async function QuotesPage() {
	await requireRouteAccess("/quotes");
	const [overview, quotes] = await Promise.all([getQuotesOverview(), getQuotes()]);
	return <QuotesPageView overview={overview} quotes={quotes} />;
}
