import OverviewCards from "@/components/common/overViewCard";
import PageTitle from "@/components/layout/pageTitle";
import type { DetailOverview } from "@/lib/overviews";
import PageWrapper from "@/components/layout/pageWrapper";

/** Shared body of the supplier, job card and machine pages: breadcrumb, title, badge and overview cards. */
export default function DetailOverviewPage({
	parent,
	detail,
}: {
	parent: { label: string; href: string };
	detail: DetailOverview;
}) {
	return (
		<PageWrapper>
			<PageTitle
				breadcrumbs={[parent, { label: detail.title }]}
				pageTitle={detail.title}
				pageDescription={detail.description}
				badge={detail.badge}
			/>
			<OverviewCards aria-label={`${detail.title} overview`} items={detail.overview} />
		</PageWrapper>
	);
}
