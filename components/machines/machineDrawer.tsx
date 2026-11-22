"use client";

import { useForm } from "react-hook-form";
import { Button } from "@/components/common/buttons";
import { Drawer } from "@/components/common/drawer";
import MainForm from "@/components/forms";
import { validators } from "@/components/forms/form.validators";
import type { FormFieldConfig } from "@/components/forms/types";
import { everyLabel, type Machine } from "@/lib/machines";

/** What the add / edit form collects. The rest of a machine (history, hours, photo) isn't edited here. */
export type MachineDetails = Pick<
	Machine,
	"name" | "serialNumber" | "location" | "bought" | "serviceEveryMonths" | "hourlyCost" | "notes"
>;

type Values = {
	name: string;
	serialNumber: string;
	location: string;
	bought: string;
	every: string;
	hourlyCost: string;
	notes: string;
};

const EVERY_OPTIONS = [1, 2, 3, 6, 12].map((m) => ({
	label: m === 1 ? "Every month" : `Every ${everyLabel(m)}`,
	value: String(m),
}));

/** Add a machine, or edit one. Production doesn't see hourly cost, so the field is left out for them. */
export default function MachineDrawer({
	machine,
	seesCost,
	onSave,
	onClose,
}: {
	/** The machine being edited; leave out to add one. */
	machine?: Machine;
	seesCost: boolean;
	onSave: (details: MachineDetails) => void;
	onClose: () => void;
}) {
	const methods = useForm<Values>({ mode: "onTouched" });

	const fields: FormFieldConfig[] = [
		{
			name: "name",
			type: "text",
			label: "Machine",
			placeholder: "e.g. Panel saw",
			defaultValue: machine?.name ?? "",
			validation: validators.required("Machine name"),
		},
		{
			name: "serialNumber",
			type: "text",
			label: "Serial number",
			defaultValue: machine?.serialNumber ?? "",
			validation: validators.required("Serial number"),
		},
		{
			name: "location",
			type: "text",
			label: "Location",
			placeholder: "e.g. Cutting bay",
			defaultValue: machine?.location ?? "",
			validation: validators.required("Location"),
		},
		{
			name: "bought",
			type: "text",
			label: "Bought",
			placeholder: "e.g. Mar 2023",
			defaultValue: machine?.bought ?? "",
			validation: validators.required("When it was bought"),
		},
		{
			name: "every",
			type: "select",
			label: "Service every",
			defaultValue: String(machine?.serviceEveryMonths ?? 3),
			options: EVERY_OPTIONS,
		},
		...(seesCost
			? ([
					{
						name: "hourlyCost",
						type: "amount",
						label: "Hourly cost",
						description:
							"Include power, blades or needles and servicing. Used to cost machine time on quotes.",
						defaultValue: String(machine?.hourlyCost ?? ""),
						validation: {
							validate: (v: string) => Number(v) > 0 || "Enter a cost above ₦0",
						},
					},
				] satisfies FormFieldConfig[])
			: []),
		{
			name: "notes",
			type: "textarea",
			label: "Notes (optional)",
			placeholder: "e.g. Book a day ahead",
			defaultValue: machine?.notes ?? "",
			rows: 3,
		},
	];

	return (
		<Drawer
			title={machine ? `Edit ${machine.name}` : "Add machine"}
			description="Photo upload isn't connected yet, so machines show an icon for now."
			onClose={onClose}
		>
			<MainForm<Values>
				methods={methods}
				fields={fields}
				rowPairs={[
					["serialNumber", "location"],
					["bought", "every"],
				]}
				hideRequiredMarks
				onSubmit={(v) =>
					onSave({
						name: v.name.trim(),
						serialNumber: v.serialNumber.trim(),
						location: v.location.trim(),
						bought: v.bought.trim(),
						serviceEveryMonths: Number(v.every),
						// Production can't see or set the cost: keep what's there
						hourlyCost: seesCost ? Number(v.hourlyCost) : (machine?.hourlyCost ?? 0),
						notes: v.notes?.trim() ?? "",
					})
				}
				renderFooter={({ canSubmit }) => (
					<div className="flex flex-wrap items-center gap-3">
						<span className="flex-1" />
						<Button onClick={onClose}>Cancel</Button>
						<Button type="submit" variant="primary" disabled={!canSubmit}>
							{machine ? "Save changes" : "Add machine"}
						</Button>
					</div>
				)}
			/>
		</Drawer>
	);
}
