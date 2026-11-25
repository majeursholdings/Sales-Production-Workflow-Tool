"use client";

import { Suspense, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createMachineAction } from "@/app/(dashboard)/machines/actions";
import { Button } from "@/components/common/buttons";
import OverviewCards from "@/components/common/overViewCard";
import PageTitle from "@/components/layout/pageTitle";
import { buildMachinesOverview, type Machine } from "@/lib/machines";
import MachineDrawer, { type MachineDetails } from "./machineDrawer";
import MachinesTable from "./machinesTable";
import MachinesTableSkeleton from "./machinesTableSkeleton";

export const machinesTitle = {
	pageTitle: "Machines",
	pageDescription: "Every workshop machine with its photo, condition and maintenance history.",
};

/**
 * The page title (with "Add machine"), the overview cards and the table all
 * depend on the machine list, so they live together here.
 */
export default function MachinesPageContent({
	machines,
	today,
	seesCost,
}: {
	machines: Machine[];
	today: string;
	seesCost: boolean;
}) {
	const [adding, setAdding] = useState(false);

	const add = async (details: MachineDetails) => {
		const result = await createMachineAction(details);
		if (!result.ok) {
			toast.error(result.message);
			return;
		}
		setAdding(false);
		toast.success(`${details.name} added. Log its first service when it's done.`);
	};

	return (
		<>
			<PageTitle
				{...machinesTitle}
				actions={
					<Button variant="primary" onClick={() => setAdding(true)}>
						<Plus />
						Add machine
					</Button>
				}
			/>
			<OverviewCards
				aria-label="All machines overview"
				items={buildMachinesOverview(machines, today)}
			/>
			{/* the table keeps its search, filter and page in the URL, which needs Suspense */}
			<Suspense fallback={<MachinesTableSkeleton seesCost={seesCost} />}>
				<MachinesTable
					machines={machines}
					today={today}
					seesCost={seesCost}
					onAdd={() => setAdding(true)}
				/>
			</Suspense>

			{adding && (
				<MachineDrawer seesCost={seesCost} onSave={add} onClose={() => setAdding(false)} />
			)}
		</>
	);
}
