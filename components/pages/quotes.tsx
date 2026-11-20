import OverviewCards, { type OverviewItem } from "@/components/common/overViewCard";
import PageTitle from "@/components/layout/pageTitle";
import PageWrapper from "@/components/layout/pageWrapper";
import { Button } from "@/components/common/buttons";
import { Plus } from "lucide-react";

export default function QuotesPage({ overview }: { overview: OverviewItem[] }) {
	return (
		<PageWrapper>
			<PageTitle
				pageTitle="Quotes"
				pageDescription="Build, send and track quotes from draft to accepted."
				actions={
					<>
						<Button variant="primary">
							<Plus />
							New quote
						</Button>
					</>
				}
			/>
			<OverviewCards aria-label="Quotes overview" items={overview} />
		</PageWrapper>
	);
}
