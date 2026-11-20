import OverviewCards, { type OverviewItem } from "@/components/common/overViewCard";
import PageTitle from "@/components/layout/pageTitle";
import PageWrapper from "@/components/layout/pageWrapper";
import { Button } from "@/components/common/buttons";
import { Plus } from "lucide-react";

export default function StaffPage({ overview }: { overview: OverviewItem[] }) {
	return (
		<PageWrapper>
			<PageTitle
				pageTitle="Staff"
				pageDescription="The people on the payroll and their roles."
				actions={
					<>
						<Button variant="primary">
							<Plus />
							Add staff member
						</Button>
					</>
				}
			/>
			<OverviewCards aria-label="Staff overview" items={overview} />
		</PageWrapper>
	);
}
