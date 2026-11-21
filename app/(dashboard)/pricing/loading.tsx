import { Card } from "@/components/common/card";
import PageTitle from "@/components/layout/pageTitle";
import PageWrapper from "@/components/layout/pageWrapper";
import { pricingTitle } from "@/components/pricing/pricingContent";
import { Table } from "@/components/tables";
import { TableSkeletonRows } from "@/components/tables/tableSkeletonRows";

/** Shown while Pricing & margins loads: the real title, placeholder rows. */
export default function Loading() {
	return (
		<PageWrapper>
			<PageTitle {...pricingTitle} />
			<Card
				flush
				className="overflow-hidden"
				aria-busy="true"
				aria-label="Loading category markups"
			>
				<Table>
					<tbody>
						<TableSkeletonRows cols={5} rows={6} />
					</tbody>
				</Table>
			</Card>
		</PageWrapper>
	);
}
