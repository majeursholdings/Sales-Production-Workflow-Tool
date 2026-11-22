"use client";

import { useState } from "react";
import { Button } from "@/components/common/buttons";
import { Drawer } from "@/components/common/drawer";
import { cn } from "@/lib/cn";
import { formatNaira } from "@/lib/currency";
import { OVERHEAD_PER_LABOUR_HOUR, type HoursRow } from "@/lib/furnitureTypes";
import QtyStepper from "./qtyStepper";

export type HoursKind = "labour" | "machine";

const COPY = {
	labour: {
		title: "Add labour to",
		intro: "Hours a role spends on one piece. Each hour is costed at that role's average rate from Staff.",
		list: "Role",
		empty: "Every role is already on this type. Change its hours in the table.",
		source: "Roles and rates come from Staff.",
		save: "Add labour",
	},
	machine: {
		title: "Add machine time to",
		intro: "Hours a machine runs for one piece. Logged machine time on job cards is compared with this.",
		list: "Machine",
		empty: "Every machine is already on this type. Change its hours in the table.",
		source: "Machines and hourly costs come from Machines.",
		save: "Add machine time",
	},
} as const;

/** Add a role's labour hours or a machine's run time to a furniture type. */
export default function AddHoursDrawer({
	kind,
	typeName,
	rates,
	existing,
	showCost,
	onAdd,
	onClose,
}: {
	kind: HoursKind;
	typeName: string;
	/** Name → hourly rate for everything that could be added. */
	rates: Record<string, number>;
	/** Rows already on the type. */
	existing: HoursRow[];
	showCost: boolean;
	onAdd: (row: HoursRow) => void;
	onClose: () => void;
}) {
	const copy = COPY[kind];
	const [picked, setPicked] = useState<string | null>(null);
	const [hours, setHours] = useState(2);

	const left = Object.keys(rates).filter((name) => !existing.some((r) => r.name === name));
	const rate = picked ? rates[picked] : 0;

	return (
		<Drawer
			title={`${copy.title} ${typeName.toLowerCase()}`}
			description={copy.intro}
			onClose={onClose}
			footer={
				<>
					<span className="min-w-0 flex-1 text-small text-fg-secondary">
						{picked && showCost
							? `Adds ${formatNaira(hours * rate)} per piece${
									kind === "labour"
										? `, plus ${formatNaira(hours * OVERHEAD_PER_LABOUR_HOUR)} workshop overhead.`
										: "."
								}`
							: picked
								? ""
								: "Pick one to see what it adds."}
					</span>
					<Button onClick={onClose}>Cancel</Button>
					<Button
						variant="primary"
						disabled={!picked}
						onClick={() => picked && onAdd({ name: picked, rate, hours })}
					>
						{copy.save}
					</Button>
				</>
			}
		>
			{left.length === 0 ? (
				<p className="text-body text-fg-secondary">{copy.empty}</p>
			) : (
				<>
					<div role="group" aria-label={copy.list} className="flex flex-col gap-2">
						{left.map((name) => (
							<button
								key={name}
								type="button"
								aria-pressed={picked === name}
								onClick={() => setPicked(name)}
								className={cn(
									"flex w-full cursor-pointer items-center justify-between gap-3 rounded-md border border-line p-3 text-start hover:bg-subtle",
									"aria-pressed:border-accent aria-pressed:bg-accent-subtle",
								)}
							>
								<strong>{name}</strong>
								{showCost && (
									<span className="text-small text-fg-secondary tabular">
										{formatNaira(rates[name]).replace(".00", "")}/h
									</span>
								)}
							</button>
						))}
					</div>
					<div className="flex flex-wrap items-center gap-3">
						<span className="text-body font-bold">Hours per piece</span>
						<QtyStepper
							value={hours}
							onChange={setHours}
							decLabel="Fewer hours"
							incLabel="More hours"
							unit="hours"
						/>
					</div>
					<p className="text-small text-fg-tertiary">{copy.source}</p>
				</>
			)}
		</Drawer>
	);
}
