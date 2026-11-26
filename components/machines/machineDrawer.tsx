"use client";

import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/common/buttons";
import { Drawer } from "@/components/common/drawer";
import MainForm from "@/components/forms";
import type { SavedFile } from "@/components/forms/fileInput";
import { validators } from "@/components/forms/form.validators";
import type { FormFieldConfig } from "@/components/forms/types";
import { MACHINE_STATUS, everyLabel, type Machine, type MachineCondition } from "@/lib/machines";
import { resolveUploadedPhotos } from "@/lib/storageClient";

/** What the add / edit form collects. The rest of a machine (history, hours) isn't edited here. */
export type MachineDetails = Pick<
	Machine,
	| "name"
	| "serialNumber"
	| "location"
	| "bought"
	| "serviceEveryMonths"
	| "hourlyCost"
	| "notes"
	| "condition"
> & { photoUrl: string };

type Values = {
	photo: unknown;
	name: string;
	serialNumber: string;
	location: string;
	bought: string;
	every: string;
	hourlyCost: string;
	notes: string;
	condition: MachineCondition;
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
	onSave: (details: MachineDetails) => void | Promise<void>;
	onClose: () => void;
}) {
	const initialPhoto: SavedFile[] = machine?.photoUrl
		? [{ id: machine.id, url: machine.photoUrl, name: `${machine.name} photo`, kind: "image" }]
		: [];
	const methods = useForm<Values>({
		mode: "onTouched",
		defaultValues: { photo: initialPhoto },
	});

	const fields: FormFieldConfig[] = [
		{
			name: "photo",
			type: "image",
			label: machine?.photoUrl ? "Photo (replace or remove)" : "Photo (optional)",
			description: "JPG, PNG, WebP or HEIC, up to 10 MB",
			maxSizeMB: 10,
			showPreview: true,
		},
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
		...(machine
			? ([
					{
						name: "condition",
						type: "select",
						label: "Condition",
						description:
							"Out of service takes it off job cards until it's working again. Say why in the notes.",
						defaultValue: machine.condition,
						options: (["working", "out_of_service"] as const).map((c) => ({
							value: c,
							label: c === "working" ? "Working" : MACHINE_STATUS[c].label,
						})),
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
			description={
				machine
					? `${machine.serialNumber} · ${machine.location}`
					: "Add workshop details and an optional photo so everyone can spot the machine."
			}
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
				onSubmit={async (v) => {
					const uploaded = await resolveUploadedPhotos("machines", v.photo);
					if (!uploaded.ok) {
						toast.error(uploaded.message);
						return;
					}
					await onSave({
						condition: machine ? v.condition : "working",
						name: v.name.trim(),
						serialNumber: v.serialNumber.trim(),
						location: v.location.trim(),
						bought: v.bought.trim(),
						serviceEveryMonths: Number(v.every),
						// Production can't see or set the cost: keep what's there
						hourlyCost: seesCost ? Number(v.hourlyCost) : (machine?.hourlyCost ?? 0),
						notes: v.notes?.trim() ?? "",
						photoUrl: uploaded.urls[0] ?? "",
					});
				}}
				renderFooter={({ canSubmit, isLoading }) => (
					<div className="flex flex-wrap items-center gap-3">
						<span className="flex-1" />
						<Button onClick={onClose}>Cancel</Button>
						<Button type="submit" variant="primary" disabled={!canSubmit || isLoading}>
							{machine ? "Save changes" : "Add machine"}
						</Button>
					</div>
				)}
			/>
		</Drawer>
	);
}
