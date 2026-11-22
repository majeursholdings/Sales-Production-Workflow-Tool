"use client";

import { Suspense, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
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

const slug = (name: string) =>
	name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");

/**
 * The page title (with "Add machine"), the overview cards and the table all
 * depend on the machine list, so they live together here.
 */
export default function MachinesPageContent({
	initialMachines,
	today,
	seesCost,
}: {
	initialMachines: Machine[];
	today: string;
	seesCost: boolean;
}) {
	const [machines, setMachines] = useState(initialMachines);
	const [adding, setAdding] = useState(false);

	const add = (details: MachineDetails) => {
		const taken = new Set(machines.map((m) => m.id));
		const base = slug(details.name) || "machine";
		let id = base;
		for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;

		setMachines((list) => [
			...list,
			{
				...details,
				id,
				usedIn: "Not used yet",
				condition: "working",
				nextService: null,
				hoursTotal: 0,
				hoursMonth: 0,
				lastUsed: { when: "Not used yet", job: "No job cards" },
				icon: "cnc",
				history: [],
			},
		]);
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
			{/* the table keeps its search, filter and page in the URL, which needs Suspense on a static page */}
			<Suspense fallback={<MachinesTableSkeleton seesCost={seesCost} />}>
				<MachinesTable machines={machines} today={today} seesCost={seesCost} />
			</Suspense>

			{adding && (
				<MachineDrawer seesCost={seesCost} onSave={add} onClose={() => setAdding(false)} />
			)}
		</>
	);
}
