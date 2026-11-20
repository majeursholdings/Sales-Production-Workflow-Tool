import OverviewCards, { type OverviewItem } from "@/components/common/overViewCard";
import PageTitle from "../layout/pageTitle";
import PageWrapper from "@/components/layout/pageWrapper";

type DashboardPageProps = {
	greeting: string;
	overview: OverviewItem[];
};

export default function DashboardPage({ greeting, overview }: DashboardPageProps) {
	return (
		<PageWrapper>
			<PageTitle pageTitle={greeting} pageDescription="Saturday, 7 November 2026" />
			<OverviewCards aria-label="Overview" items={overview} />
		</PageWrapper>
	);
}
