import PricingPageView from "@/components/pages/pricing";
import { getMarkupCategories, getPricingHistory, getPricingRules } from "@/lib/pricing";

export default async function PricingPage() {
	const [categories, rules, history] = await Promise.all([
		getMarkupCategories(),
		getPricingRules(),
		getPricingHistory(),
	]);
	return <PricingPageView categories={categories} rules={rules} history={history} />;
}
