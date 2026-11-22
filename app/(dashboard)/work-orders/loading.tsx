import PageTitle from "@/components/layout/pageTitle";
import PageWrapper from "@/components/layout/pageWrapper";
import JobCardsTableSkeleton from "@/components/jobCards/jobCardsTableSkeleton";
import { jobCardsTitle } from "@/components/jobCards/jobCardsPageContent";

/** Shown while the job cards page fetches its data. */
export default function Loading() {
	return (
		<PageWrapper>
			<PageTitle {...jobCardsTitle} />
			<div aria-hidden="true" className="h-24 animate-pulse rounded-lg bg-subtle" />
			<JobCardsTableSkeleton />
		</PageWrapper>
	);
}
