import PageWrapper from "@/components/layout/pageWrapper";
import PricingContent from "@/components/pricing/pricingContent";
import type { MarkupCategory, PricingChange, PricingRule } from "@/lib/pricing";

export default function PricingPage(props: {
	categories: MarkupCategory[];
	rules: PricingRule[];
	history: PricingChange[];
}) {
	return (
		<PageWrapper>
			<PricingContent {...props} />
		</PageWrapper>
	);
}
