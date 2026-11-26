"use client";

import dayjs from "dayjs";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/common/buttons";
import { Drawer } from "@/components/common/drawer";
import MainForm from "@/components/forms";
import type { SavedFile } from "@/components/forms/fileInput";
import { validators } from "@/components/forms/form.validators";
import type { FormFieldConfig } from "@/components/forms/types";
import {
	MAINTENANCE_TYPES,
	everyLabel,
	type Machine,
	type MaintenanceRecord,
	type MaintenanceType,
} from "@/lib/machines";
import { MAX_PHOTOS_PER_UPLOAD } from "@/lib/storage";
import { resolveUploadedPhotos } from "@/lib/storageClient";

type Values = {
	type: MaintenanceType;
	date: string;
	doneBy: string;
	cost: string;
	nextService: string;
	notes: string;
	photos: unknown;
	working: boolean;
};

export type MaintenanceDraft = Pick<
	MaintenanceRecord,
	"type" | "date" | "doneBy" | "cost" | "notes" | "photos"
> & {
	/** The next service date; only when logging, not when editing a record. */
	nextService?: string;
	/** The machine is back in use; only offered while it's out of service. */
	backInService?: boolean;
};

const isoDay = (value: string) => dayjs(value).format("YYYY-MM-DD");

/** Log maintenance for a machine, or edit an earlier record, with optional photos. */
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
	onSave: (draft: MaintenanceDraft) => void | Promise<void>;
	onClose: () => void;
}) {
	const editing = !!record;
	const outOfService = machine.condition === "out_of_service";
	const initialPhotos: SavedFile[] = (record?.photos ?? []).map((url, i) => ({
		id: `${record?.id ?? "saved"}-${i}`,
		url,
		name: `Photo ${i + 1}`,
		kind: "image",
	}));

	const methods = useForm<Values>({
		mode: "onTouched",
		defaultValues: { photos: initialPhotos },
	});

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
		{
			name: "photos",
			type: "image",
			label: "Photos (optional)",
			description: `Up to ${MAX_PHOTOS_PER_UPLOAD} photos — receipts, worn parts, or completed work (10 MB each)`,
			multiple: true,
			maxFiles: MAX_PHOTOS_PER_UPLOAD,
			maxSizeMB: 10,
			showPreview: true,
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
				onSubmit={async (v) => {
					const uploaded = await resolveUploadedPhotos("machines", v.photos);
					if (!uploaded.ok) {
						toast.error(uploaded.message);
						return;
					}
					await onSave({
						type: v.type,
						date: isoDay(v.date),
						doneBy: v.doneBy.trim(),
						cost: Number(v.cost) || 0,
						notes: v.notes?.trim() ?? "",
						photos: uploaded.urls,
						...(editing
							? {}
							: {
									nextService: isoDay(v.nextService),
									backInService: outOfService ? v.working : undefined,
								}),
					});
				}}
				renderFooter={({ isLoading }) => (
					<div className="flex flex-wrap items-center gap-3">
						<span className="flex-1" />
						<Button onClick={onClose}>Cancel</Button>
						<Button type="submit" variant="primary" disabled={isLoading}>
							{isLoading ? "Saving…" : editing ? "Save changes" : "Save to history"}
						</Button>
					</div>
				)}
			/>
		</Drawer>
	);
}
