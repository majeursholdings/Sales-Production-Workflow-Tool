import { notFound } from "next/navigation";
import DetailOverviewPage from "@/components/pages/detailOverview";
import { getMachineDetail, sampleMachineIds } from "@/lib/overviews";

export function generateStaticParams() {
	return sampleMachineIds.map((machineId) => ({ machineId }));
}

export default async function MachinePage({ params }: PageProps<"/machines/[machineId]">) {
	const { machineId } = await params;
	const detail = await getMachineDetail(machineId);
	if (!detail) notFound();
	return <DetailOverviewPage parent={{ label: "Machines", href: "/machines" }} detail={detail} />;
}
