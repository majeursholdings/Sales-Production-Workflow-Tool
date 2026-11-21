import InvoicesTableSkeleton from "@/components/invoices/invoicesTableSkeleton";
import PageTitle from "@/components/layout/pageTitle";
import PageWrapper from "@/components/layout/pageWrapper";
import { invoicesTitle } from "@/components/pages/invoices";

/** Shown while the invoices page fetches its data. */
export default function Loading() {
	return (
		<PageWrapper>
			<PageTitle {...invoicesTitle} />
			<div aria-hidden="true" className="h-24 animate-pulse rounded-lg bg-subtle" />
			<InvoicesTableSkeleton />
		</PageWrapper>
	);
}
