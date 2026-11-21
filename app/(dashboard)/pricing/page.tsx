import PricingPageView from "@/components/pages/pricing";
import { getMarkupCategories, getPricingHistory, getPricingRules } from "@/lib/pricing";
import { requireRouteAccess } from "@/lib/session";

export default async function PricingPage() {
	await requireRouteAccess("/pricing");
	const [categories, rules, history] = await Promise.all([
		getMarkupCategories(),
		getPricingRules(),
		getPricingHistory(),
	]);
	return <PricingPageView categories={categories} rules={rules} history={history} />;
}
