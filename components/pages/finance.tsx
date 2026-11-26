import FinancePageContent from "@/components/finance/financePageContent";
import PageWrapper from "@/components/layout/pageWrapper";
import type { FinanceData } from "@/lib/data/finance";

export default function FinancePage({ data }: { data: FinanceData }) {
	return (
		<PageWrapper>
			<FinancePageContent data={data} />
		</PageWrapper>
	);
}
