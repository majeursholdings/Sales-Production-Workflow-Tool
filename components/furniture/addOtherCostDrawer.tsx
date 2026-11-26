"use client";

import { useForm, useWatch } from "react-hook-form";
import { Button } from "@/components/common/buttons";
import { Drawer } from "@/components/common/drawer";
import MainForm from "@/components/forms";
import type { FormFieldConfig } from "@/components/forms/types";
import { formatNaira } from "@/lib/currency";
import type { ExtraCost, OtherCostOption } from "@/lib/furnitureTypes";

type Values = { pick: string; name: string; type: ExtraCost["type"]; amount: string };

const CUSTOM = "__custom";

/** Add a cost to each piece, such as wrapping, crating or installation. */
export default function AddOtherCostDrawer({
	typeName,
	options: allOptions,
	existing,
	onAdd,
	onClose,
}: {
	typeName: string;
	/** Standard costs from Cost rates. */
	options: OtherCostOption[];
	existing: ExtraCost[];
	onAdd: (cost: ExtraCost) => void;
	onClose: () => void;
}) {
	const options = allOptions.filter((o) => !existing.some((e) => e.name === o.name));
	const first = options[0];

	const methods = useForm<Values>({
		mode: "onTouched",
		defaultValues: {
			pick: first?.id ?? CUSTOM,
			name: "",
			type: first?.type ?? "Direct",
			amount: first?.amount ? String(first.amount) : "",
		},
	});
	const pick = useWatch({ control: methods.control, name: "pick" });
	const picked = options.find((o) => o.id === pick);
	const custom = pick === CUSTOM;

	const fields: FormFieldConfig[] = [
		{
			name: "pick",
			type: "select",
			label: "Cost",
			defaultValue: first?.id ?? CUSTOM,
			description: picked?.note || (custom ? "Not in Cost rates; name it below." : undefined),
			options: [
				...options.map((o) => ({
					value: o.id,
					label: o.amount
						? `${o.name} · ${formatNaira(o.amount).replace(".00", "")}`
						: o.name,
				})),
				{ value: CUSTOM, label: "Another cost" },
			],
		},
		...(custom
			? [
					{
						name: "name",
						type: "text",
						label: "Name",
						placeholder: "e.g. Glass top",
						validation: {
							validate: (value: string) =>
								value.trim().length > 0 || "Give the cost a name.",
						},
					} satisfies FormFieldConfig,
				]
			: []),
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
			description="A cost charged on every piece of this type, on top of parts, labour and machines. Standard costs come from Cost rates."
			onClose={onClose}
		>
			<MainForm<Values>
				methods={methods}
				fields={fields}
				hideRequiredMarks
				requireValidToSubmit={false}
				onSubmit={(v) => {
					const name = custom ? v.name.trim() : (picked?.name ?? "");
					if (existing.some((e) => e.name === name)) return;
					onAdd({
						name,
						type: v.type,
						amount: Number(v.amount),
						costItemId: custom ? null : (picked?.id ?? null),
					});
				}}
				renderFooter={() => (
					<div className="flex flex-wrap justify-end gap-3">
						<Button onClick={onClose}>Cancel</Button>
						<Button type="submit" variant="primary">
							Add cost
						</Button>
					</div>
				)}
			/>
		</Drawer>
	);
}
