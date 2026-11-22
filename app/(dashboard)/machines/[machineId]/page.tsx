import dayjs from "dayjs";
import { notFound } from "next/navigation";
import PageWrapper from "@/components/layout/pageWrapper";
import MachineDetailView from "@/components/machines/machineDetailView";
import { getMachine, sampleMachineIds } from "@/lib/machines";
import { isOwnerAppRole } from "@/lib/roles";
import { requireRouteAccess } from "@/lib/session";

export function generateStaticParams() {
	return sampleMachineIds.map((machineId) => ({ machineId }));
}

export default async function MachinePage({ params }: PageProps<"/machines/[machineId]">) {
	const user = await requireRouteAccess("/machines");
	const { machineId } = await params;
	const machine = await getMachine(machineId);
	if (!machine) notFound();
	return (
		<PageWrapper>
			<MachineDetailView
				// a different machine is a fresh page, with its own edits
				key={machine.id}
				initialMachine={machine}
				today={dayjs().format("YYYY-MM-DD")}
				viewer={{
					name: user.name,
					seesCost: user.roleKey !== "production",
					canDelete: isOwnerAppRole(user.roleKey),
				}}
			/>
		</PageWrapper>
	);
}
