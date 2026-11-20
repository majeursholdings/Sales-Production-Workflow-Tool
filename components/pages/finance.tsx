import OverviewCards, { type OverviewItem } from "@/components/common/overViewCard";
import PageTitle from "@/components/layout/pageTitle";
import PageWrapper from "@/components/layout/pageWrapper";
import { Button } from "@/components/common/buttons";
import { Download, Plus } from "lucide-react";

export default function FinancePage({ overview }: { overview: OverviewItem[] }) {
	return (
		<PageWrapper>
			<PageTitle
				pageTitle="Revenue & expenses"
				pageDescription="Money in and money out, with what's still owed."
				actions={
					<>
						<Button variant="secondary">
							<Download />
							Download report
						</Button>
						<Button variant="primary">
							<Plus />
							Record expense
						</Button>
					</>
				}
			/>
			<OverviewCards aria-label="Revenue and expenses overview" items={overview} />
		</PageWrapper>
	);
}
