import { Suspense } from "react";
import InvoicesTable from "@/components/invoices/invoicesTable";
import InvoicesTableSkeleton from "@/components/invoices/invoicesTableSkeleton";
import OverviewCards, { type OverviewItem } from "@/components/common/overViewCard";
import PageTitle from "@/components/layout/pageTitle";
import PageWrapper from "@/components/layout/pageWrapper";
import type { InvoiceRow } from "@/lib/invoices";

export const invoicesTitle = {
	pageTitle: "Invoices",
	pageDescription:
		"An invoice is created when a deposit is recorded on a quote. The person who recorded it is shown as the creator.",
};

export default function InvoicesPage({
	overview,
	invoices,
}: {
	overview: OverviewItem[];
	invoices: InvoiceRow[];
}) {
	return (
		<PageWrapper>
			<PageTitle {...invoicesTitle} />
			<OverviewCards aria-label="Invoices overview" items={overview} />
			{/* the table keeps its search, filter and page in the URL, which needs Suspense on a static page */}
			<Suspense fallback={<InvoicesTableSkeleton />}>
				<InvoicesTable invoices={invoices} />
			</Suspense>
		</PageWrapper>
	);
}
