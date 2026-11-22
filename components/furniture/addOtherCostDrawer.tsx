"use client";

import { useForm, useWatch } from "react-hook-form";
import { Button } from "@/components/common/buttons";
import { Drawer } from "@/components/common/drawer";
import MainForm from "@/components/forms";
import type { FormFieldConfig } from "@/components/forms/types";
import { formatNaira } from "@/lib/currency";
import { OTHER_COST_OPTIONS, type ExtraCost } from "@/lib/furnitureTypes";

type Values = { name: string; type: ExtraCost["type"]; amount: string };

/** Add a one-off cost to each piece, such as wrapping, crating or installation. */
export default function AddOtherCostDrawer({
	typeName,
	existing,
	onAdd,
	onClose,
}: {
	typeName: string;
	existing: ExtraCost[];
	onAdd: (cost: ExtraCost) => void;
	onClose: () => void;
}) {
	const options = OTHER_COST_OPTIONS.filter((o) => !existing.some((e) => e.name === o.name));
	const first = options[0];

	const methods = useForm<Values>({
		mode: "onTouched",
		defaultValues: {
			name: first?.name ?? "",
			type: first?.type ?? "Direct",
			amount: first?.amount ? String(first.amount) : "",
		},
	});
	const name = useWatch({ control: methods.control, name: "name" });
	const picked = options.find((o) => o.name === name);

	const fields: FormFieldConfig[] = [
		{
			name: "name",
			type: "select",
			label: "Cost",
			defaultValue: first?.name ?? "",
			description: picked?.note,
			options: options.map((o) => ({
				value: o.name,
				label: o.amount
					? `${o.name} · ${formatNaira(o.amount).replace(".00", "")}`
					: o.name,
			})),
		},
		{
			name: "amount",
			type: "amount",
			label: "Amount per piece",
			placeholder: "0",
			validation: {
				validate: (value: string) =>
					Number(value) > 0 || "Enter an amount greater than ₦0.",
			},
		},
		{
			name: "type",
			type: "radio",
			label: "Type",
			defaultValue: first?.type ?? "Direct",
			options: [
				{ value: "Direct", label: "Direct: goes into the piece" },
				{ value: "Indirect", label: "Indirect: shared overhead" },
			],
		},
	];

	return (
		<Drawer
			title={`Add other cost to ${typeName.toLowerCase()}`}
			description="A cost charged on every piece of this type, on top of parts, labour and machines."
			onClose={onClose}
		>
			{options.length === 0 ? (
				<>
					<p className="text-body text-fg-secondary">
						Every standard cost is already on this type.
					</p>
					<Button className="self-start" onClick={onClose}>
						Close
					</Button>
				</>
			) : (
				<MainForm<Values>
					methods={methods}
					fields={fields}
					hideRequiredMarks
					requireValidToSubmit={false}
					onSubmit={(v) =>
						onAdd({ name: v.name, type: v.type, amount: Number(v.amount) })
					}
					renderFooter={() => (
						<div className="flex flex-wrap justify-end gap-3">
							<Button onClick={onClose}>Cancel</Button>
							<Button type="submit" variant="primary">
								Add cost
							</Button>
						</div>
					)}
				/>
			)}
		</Drawer>
	);
}
