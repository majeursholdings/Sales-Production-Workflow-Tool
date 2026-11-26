import MachinesPageContent from "@/components/machines/machinesPageContent";
import PageWrapper from "@/components/layout/pageWrapper";
import type { Machine } from "@/lib/machines";

export default function MachinesPage({
	machines,
	today,
	seesCost,
}: {
	machines: Machine[];
	today: string;
	seesCost: boolean;
}) {
	return (
		<PageWrapper>
			<MachinesPageContent machines={machines} today={today} seesCost={seesCost} />
		</PageWrapper>
	);
}
