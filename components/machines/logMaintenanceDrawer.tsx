"use client";

import dayjs from "dayjs";
import { useForm } from "react-hook-form";
import { Button } from "@/components/common/buttons";
import { Drawer } from "@/components/common/drawer";
import MainForm from "@/components/forms";
import { validators } from "@/components/forms/form.validators";
import type { FormFieldConfig } from "@/components/forms/types";
import {
	MAINTENANCE_TYPES,
	everyLabel,
	type Machine,
	type MaintenanceRecord,
	type MaintenanceType,
} from "@/lib/machines";

type Values = {
	type: MaintenanceType;
	date: string;
	doneBy: string;
	cost: string;
	nextService: string;
	notes: string;
	working: boolean;
};

export type MaintenanceDraft = Pick<
	MaintenanceRecord,
	"type" | "date" | "doneBy" | "cost" | "notes"
> & {
	/** The next service date; only when logging, not when editing a record. */
	nextService?: string;
	/** The machine is back in use; only offered while it's out of service. */
	backInService?: boolean;
};

const isoDay = (value: string) => dayjs(value).format("YYYY-MM-DD");

/** Log maintenance for a machine, or edit an earlier record. Photos aren't attached yet: upload isn't connected. */
export default function LogMaintenanceDrawer({
	machine,
	record,
	today,
	userName,
	onSave,
	onClose,
}: {
	machine: Machine;
	/** The record being edited; leave out to log new maintenance. */
	record?: MaintenanceRecord;
	today: string;
	userName: string;
	onSave: (draft: MaintenanceDraft) => void;
	onClose: () => void;
}) {
	const editing = !!record;
	const outOfService = machine.condition === "out_of_service";

	const methods = useForm<Values>({ mode: "onTouched" });

	const fields: FormFieldConfig[] = [
		{
			name: "type",
			type: "select",
			label: "What was done",
			defaultValue: record?.type ?? (outOfService ? "Repair" : "Servicing"),
			options: MAINTENANCE_TYPES.map((t) => ({ label: t, value: t })),
		},
		{
			name: "date",
			type: "date",
			label: "Date",
			defaultValue: record?.date ?? today,
			maxDate: today,
			validation: validators.required("Date"),
		},
		{
			name: "doneBy",
			type: "text",
			label: "Done by",
			placeholder: "Staff member or service company",
			defaultValue: record?.doneBy ?? userName,
			validation: validators.required("Who did it"),
		},
		{
			name: "cost",
			type: "amount",
			label: "Cost",
			description:
				"Parts and labour. Use 0 if it cost nothing. Accounting records it as an expense.",
			defaultValue: record ? String(record.cost) : "",
			validation: {
				validate: (v: string) =>
					(v ?? "").trim() !== "" || "Enter the cost. Use 0 if it cost nothing.",
			},
		},
		...(editing
			? []
			: ([
					{
						name: "nextService",
						type: "date",
						label: "Next service due",
						description: `From “Service every ${everyLabel(machine.serviceEveryMonths)}”; change it if needed.`,
						minDate: today,
						defaultValue: dayjs(today)
							.add(machine.serviceEveryMonths, "month")
							.toISOString(),
						validation: validators.required("Next service date"),
					},
				] satisfies FormFieldConfig[])),
		{
			name: "notes",
			type: "textarea",
			label: "Notes",
			description: "Parts used, readings, anything the next person should know.",
			placeholder:
				"e.g. Replaced drive belt rubber and checked tension; old belt was cracked",
			defaultValue: record?.notes ?? "",
			rows: 4,
		},
		...(!editing && outOfService
			? ([
					{
						name: "working",
						type: "checkbox",
						label: "Machine is working again",
						defaultValue: true,
					},
				] satisfies FormFieldConfig[])
			: []),
	];

	return (
		<Drawer
			title={editing ? "Edit maintenance" : "Log maintenance"}
			description={machine.name}
			onClose={onClose}
		>
			<MainForm<Values>
				methods={methods}
				fields={fields}
				rowPairs={[["date", "doneBy"]]}
				hideRequiredMarks
				requireValidToSubmit={false}
				onSubmit={(v) =>
					onSave({
						type: v.type,
						date: isoDay(v.date),
						doneBy: v.doneBy.trim(),
						cost: Number(v.cost) || 0,
						notes: v.notes?.trim() ?? "",
						...(editing
							? {}
							: {
									nextService: isoDay(v.nextService),
									backInService: outOfService ? v.working : undefined,
								}),
					})
				}
				renderFooter={() => (
					<div className="flex flex-wrap items-center gap-3">
						<span className="min-w-0 flex-1 text-small text-fg-tertiary">
							Photo upload isn&apos;t connected yet.
						</span>
						<Button onClick={onClose}>Cancel</Button>
						<Button type="submit" variant="primary">
							{editing ? "Save changes" : "Save to history"}
						</Button>
					</div>
				)}
			/>
		</Drawer>
	);
}
