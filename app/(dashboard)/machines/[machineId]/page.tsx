import { notFound } from "next/navigation";
import DetailOverviewPage from "@/components/pages/detailOverview";
import { getMachineDetail, sampleMachineIds } from "@/lib/overviews";
import { requireRouteAccess } from "@/lib/session";

export function generateStaticParams() {
	return sampleMachineIds.map((machineId) => ({ machineId }));
}

export default async function MachinePage({ params }: PageProps<"/machines/[machineId]">) {
	await requireRouteAccess("/machines");
	const { machineId } = await params;
	const detail = await getMachineDetail(machineId);
	if (!detail) notFound();
	return <DetailOverviewPage parent={{ label: "Machines", href: "/machines" }} detail={detail} />;
}
