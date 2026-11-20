import PageTitle from "@/components/layout/pageTitle";
import PageWrapper from "@/components/layout/pageWrapper";
import { quotesTitle } from "@/components/pages/quotes";
import QuotesTableSkeleton from "@/components/quotes/quotesTableSkeleton";

/** Shown while the quotes page fetches its data. */
export default function Loading() {
	return (
		<PageWrapper>
			<PageTitle {...quotesTitle} />
			<div aria-hidden="true" className="h-24 animate-pulse rounded-lg bg-subtle" />
			<QuotesTableSkeleton />
		</PageWrapper>
	);
}
