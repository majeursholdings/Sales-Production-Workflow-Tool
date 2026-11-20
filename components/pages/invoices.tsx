import OverviewCards, { type OverviewItem } from "@/components/common/overViewCard";
import PageTitle from "@/components/layout/pageTitle";
import PageWrapper from "@/components/layout/pageWrapper";

export default function InvoicesPage({ overview }: { overview: OverviewItem[] }) {
	return (
		<PageWrapper>
			<PageTitle
				pageTitle="Invoices"
				pageDescription="Invoices raised from accepted quotes, and which are paid."
			/>
			<OverviewCards aria-label="Invoices overview" items={overview} />
		</PageWrapper>
	);
}
