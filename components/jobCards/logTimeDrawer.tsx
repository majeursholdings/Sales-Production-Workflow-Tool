"use client";

import { useForm, useWatch } from "react-hook-form";
import dayjs from "dayjs";
import { Button } from "@/components/common/buttons";
import { Drawer } from "@/components/common/drawer";
import MainForm from "@/components/forms";
import { validators } from "@/components/forms/form.validators";
import type { FormFieldConfig } from "@/components/forms/types";
import {
	STEP_NAMES,
	STEP_STATUS,
	parseHours,
	type JobCard,
	type LogDraft,
	type WorkshopPerson,
} from "@/lib/jobCards";
import type { MachineOption } from "@/lib/machines";

type Values = {
	step: string;
	who: string;
	date: string;
	hours: string;
	machines: string[];
	redo: boolean;
	redoNote: string;
	finished: boolean;
	notes: string;
	[machineHours: `mh_${number}`]: string;
};

const hoursRule = (message: string) => ({
	validate: (v: string) => parseHours(v) > 0 || `${message}, e.g. 3.5`,
});

/** Log the hours and machine time someone spent on a step. */
export default function LogTimeDrawer({
	card,
	step,
	finished = false,
	machines,
	people,
	userName,
	today,
	onSave,
	onClose,
}: {
	card: JobCard;
	/** The step the time goes on to start with. */
	step: number;
	/** Start with "This step is finished" ticked. */
	finished?: boolean;
	/** Machines that are in service and can be picked. */
	machines: MachineOption[];
	/** The Production team. */
	people: WorkshopPerson[];
	userName: string;
	today: string;
	onSave: (draft: LogDraft) => void | Promise<void>;
	onClose: () => void;
}) {
	const methods = useForm<Values>({ mode: "onTouched", defaultValues: { machines: [] } });
	const picked = useWatch({ control: methods.control, name: "machines" }) ?? [];
	const redo = useWatch({ control: methods.control, name: "redo" });

	// The Production team, plus whoever is logging if they aren't on it
	const names = people.map((p) => p.name);
	const whoOptions = names.includes(userName) ? names : [userName, ...names];
	const machineName = (id: string) => machines.find((m) => m.id === id)?.name ?? id;

	const fields: FormFieldConfig[] = [
		{
			name: "step",
			type: "select",
			label: "Step",
			defaultValue: String(step),
			options: card.steps.map((s, i) => ({
				value: String(i),
				label: `${i + 1}. ${STEP_NAMES[i]} · ${STEP_STATUS[s.status].label}`,
			})),
		},
		{
			name: "who",
			type: "select",
			label: "Who",
			defaultValue: userName,
			description: people.length
				? undefined
				: "Add the Production team under Staff so they can be picked here.",
			options: whoOptions.map((p) => ({ label: p, value: p })),
		},
		{
			name: "date",
			type: "date",
			label: "Date",
			defaultValue: today,
			maxDate: today,
			validation: validators.required("Date"),
		},
		{
			name: "hours",
			type: "text",
			label: "Hours worked",
			description: "Use halves, e.g. 3.5",
			inputMode: "decimal",
			defaultValue: "",
			validation: hoursRule("Enter the hours worked"),
		},
		{
			name: "machines",
			type: "multiselect",
			label: "Machines used",
			description: machines.length
				? "Machine hours update each machine's usage on the Machines page."
				: "No machines are in service. Add them on the Machines page.",
			placeholder: "No machines",
			options: machines.map((m) => ({ label: m.name, value: m.id })),
		},
		...picked.map((id, i): FormFieldConfig => ({
			name: `mh_${i}`,
			type: "text",
			label: `${machineName(id)}: hours`,
			inputMode: "decimal",
			defaultValue: "",
			validation: hoursRule(`Enter the hours on the ${machineName(id).toLowerCase()}`),
		})),
		{ name: "redo", type: "checkbox", label: "This was redo work", defaultValue: false },
		...(redo
			? ([
					{
						name: "redoNote",
						type: "text",
						label: "Why it was redone",
						placeholder: "e.g. Frame joint loose, re-glued and clamped",
						defaultValue: "",
						validation: validators.required("Why it was redone"),
					},
				] satisfies FormFieldConfig[])
			: []),
		{
			name: "notes",
			type: "textarea",
			label: "Notes (optional)",
			placeholder: "Anything the next person should know",
			defaultValue: "",
			rows: 3,
		},
		{
			name: "finished",
			type: "checkbox",
			label: "This step is finished",
			defaultValue: finished,
		},
	];

	return (
		<Drawer title="Log time" description={`${card.id} · ${card.client}`} onClose={onClose}>
			<MainForm<Values>
				methods={methods}
				fields={fields}
				rowPairs={[["who", "date"]]}
				hideRequiredMarks
				requireValidToSubmit={false}
				onSubmit={(v) =>
					onSave({
						step: Number(v.step),
						who: v.who,
						date: dayjs(v.date).format("YYYY-MM-DD"),
						hours: parseHours(v.hours),
						machines: (v.machines ?? []).map((machineId, i) => ({
							machineId,
							machine: machineName(machineId),
							hours: parseHours(v[`mh_${i}`]),
						})),
						redoNote: v.redo ? v.redoNote.trim() : undefined,
						notes: v.notes?.trim() || undefined,
						finished: v.finished,
					})
				}
				renderFooter={({ isLoading }) => (
					<div className="flex flex-wrap items-center justify-end gap-3">
						<Button onClick={onClose}>Cancel</Button>
						<Button type="submit" variant="primary" disabled={isLoading}>
							Log time
						</Button>
					</div>
				)}
			/>
		</Drawer>
	);
}
