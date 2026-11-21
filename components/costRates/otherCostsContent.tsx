"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/common/buttons";
import { Chip } from "@/components/common/badge";
import { Card } from "@/components/common/card";
import { controlClass } from "@/components/forms/input";
import PageTitle from "@/components/layout/pageTitle";
import { DataTable, IconButton, type ColumnDef } from "@/components/tables";
import { cn } from "@/lib/cn";
import type { CostItem } from "@/lib/costRates";
import { wholeNaira } from "@/lib/quoteBuilder";
import { saveContingencyAction, saveCostItemAction } from "@/app/(dashboard)/cost-rates/actions";
import { costRatesTitle } from "./costRatesTitle";
import CostItemDrawer from "./costItemDrawer";
import CostRatesTabs from "./costRatesTabs";

export const costItemColumns = (onEdit?: (item: CostItem) => void): ColumnDef<CostItem>[] => [
	{
		key: "name",
		header: "Cost item",
		cell: (c) => (
			<span className="flex flex-col">
				<span className="font-bold text-fg">{c.name}</span>
				<span className="text-small text-fg-tertiary">{c.note}</span>
			</span>
		),
	},
	{ key: "type", header: "Type", cell: (c) => <Chip>{c.type}</Chip> },
	{ key: "per", header: "Charged" },
	{
		key: "amount",
		header: "Amount",
		className: "text-end",
		cell: (c) => (
			<span className="font-bold whitespace-nowrap text-fg tabular">
				{c.amount ? wholeNaira(c.amount) : "Quoted per project"}
			</span>
		),
	},
	{
		key: "actions",
		header: <span className="sr-only">Actions</span>,
		className: "w-12 text-end",
		cell: (c) => (
			<IconButton aria-label={`Edit ${c.name}`} title="Edit" onClick={() => onEdit?.(c)}>
				<Pencil aria-hidden="true" />
			</IconButton>
		),
	},
];

/** The Other costs tab: standard cost items and the contingency. They share the title's "Add cost item" button. */
export default function OtherCostsContent({
	initialItems,
	initialContingency,
}: {
	initialItems: CostItem[];
	initialContingency: number;
}) {
	const [items, setItems] = useState(initialItems);
	// null = closed, "new" = adding, otherwise the item being edited
	const [drawer, setDrawer] = useState<CostItem | "new" | null>(null);
	const [contingency, setContingency] = useState(String(initialContingency));
	const [savingContingency, setSavingContingency] = useState(false);

	const percent = Number(contingency.replace(/[^0-9.]/g, "")) || 0;

	return (
		<>
			<PageTitle
				{...costRatesTitle}
				actions={
					<Button variant="primary" onClick={() => setDrawer("new")}>
						<Plus />
						Add cost item
					</Button>
				}
			/>
			<CostRatesTabs active="other" />

			<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
				<div className="flex min-w-0 flex-col gap-3">
					<DataTable
						tableId="cost-items"
						columns={costItemColumns(setDrawer)}
						rows={items}
						toolbar={
							<div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
								<h2 className="flex-1">Standard cost items</h2>
								<span className="text-small text-fg-tertiary">
									Picked on furniture types and quotes
								</span>
							</div>
						}
						emptyMessage="No cost items yet. Add the first one."
					/>
					<p className="text-small text-fg-tertiary">
						Direct costs belong to one piece or project, like delivery or a third
						party&apos;s work. Indirect costs support the project without being part of
						the piece, like a site visit.
					</p>
				</div>

				<aside aria-label="Contingency" className="flex min-w-0 flex-col gap-6">
					<Card className="gap-4">
						<h2>Contingency for unplanned costs</h2>
						<label className="flex flex-col gap-2">
							<span className="text-body font-bold">
								Added to every quote&apos;s cost
							</span>
							<span className="relative flex items-center">
								<input
									value={contingency}
									onChange={(e) => setContingency(e.target.value)}
									inputMode="decimal"
									className={cn(controlClass, "h-10 pe-8")}
								/>
								<span
									aria-hidden="true"
									className="pointer-events-none absolute end-3 text-fg-tertiary"
								>
									%
								</span>
							</span>
							<small className="text-small text-fg-tertiary">
								A percentage of the total cost, before markup. Covers breakages,
								price rises and rework.
							</small>
						</label>
						<p className="text-small text-fg-tertiary">
							On a ₦1,000,000 cost, {percent}% adds{" "}
							{wholeNaira((1000000 * percent) / 100)}.
						</p>
						<Button
							variant="primary"
							className="self-start"
							disabled={savingContingency}
							onClick={async () => {
								setSavingContingency(true);
								const result = await saveContingencyAction({ percent });
								setSavingContingency(false);
								if (!result.ok) {
									toast.error(result.message);
									return;
								}
								toast.success(
									"Saved. New quotes use these rates from now on; quotes already sent keep theirs.",
								);
							}}
						>
							{savingContingency ? "Saving…" : "Save"}
						</Button>
					</Card>
				</aside>
			</div>

			{drawer && (
				<CostItemDrawer
					item={drawer === "new" ? undefined : drawer}
					onClose={() => setDrawer(null)}
					onSave={async (draft) => {
						const editing = drawer !== "new";
						const result = await saveCostItemAction({
							id: editing ? drawer.id : undefined,
							name: draft.name,
							note: draft.note,
							type: draft.type,
							per: draft.per,
							amount: draft.amount,
						});
						if (!result.ok) {
							toast.error(result.message);
							return;
						}
						const saved = result.data;
						setItems((list) =>
							editing
								? list.map((c) => (c.id === saved.id ? saved : c))
								: [...list, saved],
						);
						setDrawer(null);
						toast.success(editing ? `${saved.name} saved.` : "Cost item added.");
					}}
				/>
			)}
		</>
	);
}
