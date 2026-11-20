import CostRatesTabs from "@/components/costRates/costRatesTabs";
import { costRatesTitle } from "@/components/costRates/costRatesTitle";
import PageTitle from "@/components/layout/pageTitle";
import PageWrapper from "@/components/layout/pageWrapper";
import { Card } from "@/components/common/card";
import { Table } from "@/components/tables";
import { TableSkeletonRows } from "@/components/tables/tableSkeletonRows";

/** Shown while Cost rates loads: the real title and tabs, placeholder content. */
export default function Loading() {
	return (
		<PageWrapper>
			<PageTitle {...costRatesTitle} />
			<CostRatesTabs active="overhead" />
			<Card
				flush
				className="overflow-hidden"
				aria-busy="true"
				aria-label="Loading cost rates"
			>
				<Table>
					<tbody>
						<TableSkeletonRows cols={4} rows={5} />
					</tbody>
				</Table>
			</Card>
		</PageWrapper>
	);
}
