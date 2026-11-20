import OverviewCards, { type OverviewItem } from "@/components/common/overViewCard";
import PageTitle from "@/components/layout/pageTitle";
import PageWrapper from "@/components/layout/pageWrapper";
import { Button } from "@/components/common/buttons";
import { Plus } from "lucide-react";

export default function MachinesPage({ overview }: { overview: OverviewItem[] }) {
	return (
		<PageWrapper>
			<PageTitle
				pageTitle="Machines"
				pageDescription="Workshop machines, their status and maintenance log."
				actions={
					<>
						<Button variant="primary">
							<Plus />
							Add machine
						</Button>
					</>
				}
			/>
			<OverviewCards aria-label="Machines overview" items={overview} />
		</PageWrapper>
	);
}
