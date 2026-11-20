import OverviewCards, { type OverviewItem } from "@/components/common/overViewCard";
import PageTitle from "@/components/layout/pageTitle";
import PageWrapper from "@/components/layout/pageWrapper";

export default function FinancePage({ overview }: { overview: OverviewItem[] }) {
	return (
		<PageWrapper>
			<PageTitle
				pageTitle="Revenue & expenses"
				pageDescription="Money in and money out, with what's still owed."
			/>
			<OverviewCards aria-label="Revenue and expenses overview" items={overview} />
		</PageWrapper>
	);
}
