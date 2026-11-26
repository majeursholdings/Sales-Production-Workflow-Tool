import OverviewCards from "@/components/common/overViewCard";
import AttentionCard from "@/components/dashboard/attentionCard";
import ProductionCard from "@/components/dashboard/productionCard";
import {
	DeliveriesCard,
	QuotesByStatusCard,
	RecentActivityCard,
} from "@/components/dashboard/sideCards";
import PageTitle from "@/components/layout/pageTitle";
import PageWrapper from "@/components/layout/pageWrapper";
import type { DashboardData } from "@/lib/dashboard";

type DashboardPageProps = {
	greeting: string;
	data: DashboardData;
};

export default function DashboardPage({ greeting, data }: DashboardPageProps) {
	return (
		<PageWrapper>
			<PageTitle pageTitle={greeting} pageDescription={`${data.dateLabel} · ${data.scope}`} />
			<OverviewCards aria-label="Overview" items={data.overview} />
			<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
				<div className="flex min-w-0 flex-col gap-6">
					<AttentionCard items={data.attention} />
					{data.production && <ProductionCard rows={data.production} />}
				</div>
				<aside aria-label="Summary" className="flex min-w-0 flex-col gap-6">
					{data.deliveries && <DeliveriesCard items={data.deliveries} />}
					{data.pipeline && <QuotesByStatusCard rows={data.pipeline} />}
					<RecentActivityCard items={data.feed} />
				</aside>
			</div>
		</PageWrapper>
	);
}
