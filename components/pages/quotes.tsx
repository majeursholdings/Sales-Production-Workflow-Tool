import { Suspense } from "react";
import { Plus } from "lucide-react";
import { LinkButton } from "@/components/common/buttons";
import OverviewCards, { type OverviewItem } from "@/components/common/overViewCard";
import PageTitle from "@/components/layout/pageTitle";
import PageWrapper from "@/components/layout/pageWrapper";
import QuotesTable from "@/components/quotes/quotesTable";
import QuotesTableSkeleton from "@/components/quotes/quotesTableSkeleton";
import type { Quote } from "@/lib/quotes";

export const quotesTitle = {
	pageTitle: "Quotes",
	pageDescription:
		"Every quote from customer care and sales. Open one to see its status, send it again or record a deposit.",
};

export default function QuotesPage({
	overview,
	quotes,
}: {
	overview: OverviewItem[];
	quotes: Quote[];
}) {
	return (
		<PageWrapper>
			<PageTitle
				{...quotesTitle}
				actions={
					<LinkButton href="/quotes/new" variant="primary">
						<Plus />
						New quote
					</LinkButton>
				}
			/>
			<OverviewCards aria-label="Quotes overview" items={overview} />
			{/* the table keeps its search, filters and page in the URL, which needs Suspense on a static page */}
			<Suspense fallback={<QuotesTableSkeleton />}>
				<QuotesTable initialQuotes={quotes} />
			</Suspense>
		</PageWrapper>
	);
}
