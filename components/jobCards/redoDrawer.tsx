"use client";

import dayjs from "dayjs";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/common/buttons";
import { Drawer } from "@/components/common/drawer";
import MainForm from "@/components/forms";
import { validators } from "@/components/forms/form.validators";
import type { FormFieldConfig } from "@/components/forms/types";
import {
	DELIVERY_STEP,
	REDO_REASONS,
	STEP_NAMES,
	STEP_STATUS,
	parseHours,
	type JobCard,
} from "@/lib/jobCards";
import { MAX_PHOTOS_PER_UPLOAD } from "@/lib/storage";
import { resolveUploadedPhotos } from "@/lib/storageClient";

type Values = {
	step: string;
	foundAt: string;
	reason: string;
	hours: string;
	foundBy: string;
	date: string;
	notes: string;
	photos: unknown;
};

export type RedoDraft = {
	step: number;
	foundAt: string;
	reason: string;
	hours: number;
	date: string;
	photos: string[];
};

/** Work found wrong in the workshop, before delivery. The step goes back to Redo. */
export default function RedoDrawer({
	card,
	step,
	current,
	userName,
	today,
	onSave,
	onClose,
}: {
	card: JobCard;
	/** The step to start with. */
	step: number;
	/** The step the card is at now, offered as "found at". */
	current: number | null;
	userName: string;
	today: string;
	onSave: (draft: RedoDraft) => void | Promise<void>;
	onClose: () => void;
}) {
	const methods = useForm<Values>({ mode: "onTouched" });

	// Only a step that has been started can go back, and delivery is handled by Record delivery
	const redoable = card.steps
		.map((s, i) => ({ s, i }))
		.filter(({ s, i }) => i < DELIVERY_STEP && s.status !== "todo" && s.status !== "blocked");

	const fields: FormFieldConfig[] = [
		{
			name: "step",
			type: "select",
			label: "Step to redo",
			defaultValue: String(step),
			options: redoable.map(({ s, i }) => ({
				value: String(i),
				label: `${i + 1}. ${STEP_NAMES[i]} · ${STEP_STATUS[s.status].label}`,
			})),
		},
		{
			name: "foundAt",
			type: "select",
			label: "Found at",
			defaultValue: STEP_NAMES[Math.min(current ?? 0, DELIVERY_STEP - 1)],
			options: STEP_NAMES.slice(0, DELIVERY_STEP).map((n) => ({ label: n, value: n })),
		},
		{
			name: "reason",
			type: "select",
			label: "What's wrong",
			defaultValue: REDO_REASONS[0],
			options: REDO_REASONS.map((r) => ({ label: r, value: r })),
		},
		{
			name: "hours",
			type: "text",
			label: "Extra hours expected",
			inputMode: "decimal",
			defaultValue: "3",
			validation: {
				validate: (v: string) => parseHours(v) > 0 || "Enter the extra hours, e.g. 3",
			},
		},
		{
			name: "foundBy",
			type: "text",
			label: "Found by",
			defaultValue: userName,
			validation: validators.required("Who found it"),
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
			name: "notes",
			type: "textarea",
			label: "Notes",
			placeholder: "e.g. Right arm sits 5 mm higher than the left; re-cut the arm rail",
			defaultValue: "",
			rows: 3,
		},
		{
			name: "photos",
			type: "image",
			label: "Photos (optional)",
			description: `Up to ${MAX_PHOTOS_PER_UPLOAD} photos showing what needs to be redone (10 MB each)`,
			multiple: true,
			maxFiles: MAX_PHOTOS_PER_UPLOAD,
			maxSizeMB: 10,
			showPreview: true,
		},
	];

	return (
		<Drawer
			title="Record a redo"
			description={`${card.id} · ${card.client} · before delivery`}
			onClose={onClose}
		>
			<p className="text-body text-fg-secondary">
				Use this when work is found wrong in the workshop. The step goes back to “Redo”, and
				the steps after it reopen once it&apos;s fixed. For problems found by the client,
				use Record delivery instead.
			</p>
			<MainForm<Values>
				methods={methods}
				fields={fields}
				rowPairs={[
					["step", "foundAt"],
					["reason", "hours"],
					["foundBy", "date"],
				]}
				hideRequiredMarks
				requireValidToSubmit={false}
				onSubmit={async (v) => {
					const uploaded = await resolveUploadedPhotos("job-cards", v.photos);
					if (!uploaded.ok) {
						toast.error(uploaded.message);
						return;
					}
					await onSave({
						step: Number(v.step),
						foundAt: v.foundAt,
						reason: v.notes?.trim() ? `${v.reason}: ${v.notes.trim()}` : v.reason,
						hours: parseHours(v.hours),
						date: dayjs(v.date).format("YYYY-MM-DD"),
						photos: uploaded.urls,
					});
				}}
				renderFooter={({ isLoading }) => (
					<div className="flex flex-wrap items-center gap-3">
						<span className="flex-1" />
						<Button onClick={onClose}>Cancel</Button>
						<Button type="submit" variant="primary" disabled={isLoading}>
							{isLoading ? "Saving…" : "Record redo"}
						</Button>
					</div>
				)}
			/>
		</Drawer>
	);
}
