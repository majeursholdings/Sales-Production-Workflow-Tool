import { Suspense } from "react";
import OverviewCards from "@/components/common/overViewCard";
import PageTitle from "@/components/layout/pageTitle";
import { buildJobCardsOverview, type JobCard } from "@/lib/jobCards";
import JobCardsTable from "./jobCardsTable";
import JobCardsTableSkeleton from "./jobCardsTableSkeleton";

export const jobCardsTitle = {
	pageTitle: "Job cards",
	pageDescription:
		"Created when a deposit is recorded. Log the hours and machine time spent on each step so costs and lead times stay real.",
};

export default function JobCardsPageContent({ cards, today }: { cards: JobCard[]; today: string }) {
	return (
		<>
			<PageTitle {...jobCardsTitle} />
			<OverviewCards
				aria-label="Job cards overview"
				items={buildJobCardsOverview(cards, today)}
			/>
			{/* the table keeps its search, filter and page in the URL, which needs Suspense on a static page */}
			<Suspense fallback={<JobCardsTableSkeleton />}>
				<JobCardsTable cards={cards} today={today} />
			</Suspense>
		</>
	);
}
