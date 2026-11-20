import OverviewCards, { type OverviewItem } from "@/components/common/overViewCard";
import PageTitle from "@/components/layout/pageTitle";
import PageWrapper from "@/components/layout/pageWrapper";

export default function MachinesPage({ overview }: { overview: OverviewItem[] }) {
	return (
		<PageWrapper>
			<PageTitle
				pageTitle="Machines"
				pageDescription="Workshop machines, their status and maintenance log."
			/>
			<OverviewCards aria-label="Machines overview" items={overview} />
		</PageWrapper>
	);
}
