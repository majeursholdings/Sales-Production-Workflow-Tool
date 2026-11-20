import OverviewCards, { type OverviewItem } from "@/components/common/overViewCard";
import PageTitle from "@/components/layout/pageTitle";
import PageWrapper from "@/components/layout/pageWrapper";

export default function WorkOrdersPage({ overview }: { overview: OverviewItem[] }) {
	return (
		<PageWrapper>
			<PageTitle
				pageTitle="Job cards"
				pageDescription="Jobs in production and the step each one is at."
			/>
			<OverviewCards aria-label="Job cards overview" items={overview} />
		</PageWrapper>
	);
}
