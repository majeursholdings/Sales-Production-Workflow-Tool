import { notFound } from "next/navigation";
import DetailOverviewPage from "@/components/pages/detailOverview";
import { getJobCardDetail, sampleJobCardIds } from "@/lib/overviews";
import { requireRouteAccess } from "@/lib/session";

export function generateStaticParams() {
	return sampleJobCardIds.map((jobCardId) => ({ jobCardId }));
}

export default async function JobCardPage({ params }: PageProps<"/work-orders/[jobCardId]">) {
	await requireRouteAccess("/work-orders");
	const { jobCardId } = await params;
	const detail = await getJobCardDetail(jobCardId);
	if (!detail) notFound();
	return (
		<DetailOverviewPage parent={{ label: "Job cards", href: "/work-orders" }} detail={detail} />
	);
}
