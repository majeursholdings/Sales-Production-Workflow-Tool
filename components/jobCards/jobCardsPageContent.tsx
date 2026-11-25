import { Suspense } from "react";
import OverviewCards from "@/components/common/overViewCard";
import PageTitle from "@/components/layout/pageTitle";
import {
	buildJobCardsOverview,
	type JobCard,
	type PartOption,
	type QuoteOption,
} from "@/lib/jobCards";
import JobCardsTable from "./jobCardsTable";
import JobCardsTableSkeleton from "./jobCardsTableSkeleton";
import NewJobCardButton from "./newJobCardButton";

export const jobCardsTitle = {
	pageTitle: "Job cards",
	pageDescription:
		"Started when a deposit is paid. Log the hours and machine time spent on each step so costs and lead times stay real.",
};

export default function JobCardsPageContent({
	cards,
	today,
	create,
}: {
	cards: JobCard[];
	today: string;
	/** What "New job card" needs; left out for people who can't start one. */
	create?: { quotes: QuoteOption[]; parts: PartOption[] };
}) {
	return (
		<>
			<PageTitle
				{...jobCardsTitle}
				actions={
					create && (
						<NewJobCardButton
							quotes={create.quotes}
							parts={create.parts}
							today={today}
						/>
					)
				}
			/>
			<OverviewCards
				aria-label="Job cards overview"
				items={buildJobCardsOverview(cards, today)}
			/>
			{/* the table keeps its search, filter and page in the URL, which needs Suspense */}
			<Suspense fallback={<JobCardsTableSkeleton />}>
				<JobCardsTable cards={cards} today={today} canCreate={!!create} />
			</Suspense>
		</>
	);
}
