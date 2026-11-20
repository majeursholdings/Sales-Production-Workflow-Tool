"use client";

import { Button } from "@/components/common/buttons";
import { Drawer } from "@/components/common/drawer";
import MainForm from "@/components/forms";
import type { FormFieldConfig } from "@/components/forms/types";
import type { CostItem } from "@/lib/costRates";

type Values = { name: string; type: CostItem["type"]; per: string; amount: string; note: string };

const CHARGED = ["Per piece", "Per project", "Per trip", "Per visit"];

/** Add a standard cost item, or edit one. */
export default function CostItemDrawer({
	item,
	onSave,
	onClose,
}: {
	/** The item being edited; leave out to add a new one. */
	item?: CostItem;
	onSave: (item: CostItem) => void;
	onClose: () => void;
}) {
	const fields: FormFieldConfig[] = [
		{
			name: "name",
			type: "text",
			label: "Cost item",
			placeholder: "e.g. Glass top from a third party",
			defaultValue: item?.name ?? "",
			validation: { required: "Cost item is required" },
		},
		{
			name: "type",
			type: "select",
			label: "Type",
			defaultValue: item?.type ?? "Direct",
			options: [
				{ label: "Direct", value: "Direct" },
				{ label: "Indirect", value: "Indirect" },
			],
		},
		{
			name: "per",
			type: "select",
			label: "Charged",
			defaultValue: item?.per ?? "Per piece",
			options: CHARGED.map((v) => ({ label: v, value: v })),
		},
		{
			name: "amount",
			type: "text",
			label: "Amount (₦)",
			placeholder: "Leave blank to enter on each quote",
			description: "Leave blank for third-party work that's quoted per project.",
			defaultValue: item?.amount ? item.amount.toLocaleString("en-NG") : "",
			inputProps: { inputMode: "decimal" },
		},
		{
			name: "note",
			type: "textarea",
			label: "Notes (optional)",
			placeholder: "What it covers, who supplies it",
			description: "Shown under the item's name.",
			defaultValue: item?.note ?? "",
			rows: 3,
		},
	];

	return (
		<Drawer
			title={item ? `Edit ${item.name}` : "Add cost item"}
			description="Standard items can be added to a furniture type or a quote in one click."
			onClose={onClose}
		>
			<MainForm<Values>
				fields={fields}
				rowPairs={[["type", "per"]]}
				hideRequiredMarks
				requireValidToSubmit={false}
				onSubmit={(v) =>
					onSave({
						id: item?.id ?? crypto.randomUUID(),
						name: v.name.trim(),
						note: v.note?.trim() ?? "",
						type: v.type,
						per: v.per,
						amount: Number(String(v.amount ?? "").replace(/[^0-9.]/g, "")) || 0,
					})
				}
				renderFooter={() => (
					<div className="flex flex-wrap items-center justify-end gap-3">
						<Button onClick={onClose}>Cancel</Button>
						<Button type="submit" variant="primary">
							{item ? "Save changes" : "Add cost item"}
						</Button>
					</div>
				)}
			/>
		</Drawer>
	);
}
