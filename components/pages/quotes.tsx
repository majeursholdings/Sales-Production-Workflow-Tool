import OverviewCards, { type OverviewItem } from "@/components/common/overViewCard";
import PageTitle from "@/components/layout/pageTitle";
import PageWrapper from "@/components/layout/pageWrapper";

export default function QuotesPage({ overview }: { overview: OverviewItem[] }) {
	return (
		<PageWrapper>
			<PageTitle
				pageTitle="Quotes"
				pageDescription="Build, send and track quotes from draft to accepted."
			/>
			<OverviewCards aria-label="Quotes overview" items={overview} />
		</PageWrapper>
	);
}
