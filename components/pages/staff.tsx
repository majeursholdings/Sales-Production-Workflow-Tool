import OverviewCards, { type OverviewItem } from "@/components/common/overViewCard";
import PageTitle from "@/components/layout/pageTitle";
import PageWrapper from "@/components/layout/pageWrapper";

export default function StaffPage({ overview }: { overview: OverviewItem[] }) {
	return (
		<PageWrapper>
			<PageTitle
				pageTitle="Staff"
				pageDescription="The people on the payroll and their roles."
			/>
			<OverviewCards aria-label="Staff overview" items={overview} />
		</PageWrapper>
	);
}
