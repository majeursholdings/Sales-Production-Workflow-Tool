import OtherCostsContent from "@/components/costRates/otherCostsContent";
import PageWrapper from "@/components/layout/pageWrapper";
import type { CostItem } from "@/lib/costRates";

/** Cost rates, "Other costs" tab. */
export default function CostRatesOtherPage({
	items,
	contingency,
}: {
	items: CostItem[];
	contingency: number;
}) {
	return (
		<PageWrapper>
			<OtherCostsContent initialItems={items} initialContingency={contingency} />
		</PageWrapper>
	);
}
