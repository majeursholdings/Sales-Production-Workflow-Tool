import CostRatesTabs from "@/components/costRates/costRatesTabs";
import { costRatesTitle } from "@/components/costRates/costRatesTitle";
import OverheadEditor from "@/components/costRates/overheadEditor";
import PageTitle from "@/components/layout/pageTitle";
import PageWrapper from "@/components/layout/pageWrapper";
import type { OverheadInputs } from "@/lib/costRates";

/** Cost rates, "Workshop overhead" tab. */
export default function CostRatesPage({ overhead }: { overhead: OverheadInputs }) {
	return (
		<PageWrapper>
			<PageTitle {...costRatesTitle} />
			<CostRatesTabs active="overhead" />
			<OverheadEditor initial={overhead} />
		</PageWrapper>
	);
}
