"use client";

import dayjs from "dayjs";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/common/buttons";
import { Drawer } from "@/components/common/drawer";
import MainForm from "@/components/forms";
import { validators } from "@/components/forms/form.validators";
import type { FormFieldConfig } from "@/components/forms/types";
import {
	DELIVERY_STEP,
	REJECTION_REASONS,
	STEP_NAMES,
	type DeliveryDraft,
	type JobCard,
} from "@/lib/jobCards";
import { MAX_PHOTOS_PER_UPLOAD } from "@/lib/storage";
import { resolveUploadedPhotos } from "@/lib/storageClient";

type Values = {
	outcome: "accepted" | "rejected";
	date: string;
	by: string;
	what: string;
	reason: string;
	backTo: string;
	notes: string;
	photos: unknown;
};

/** Record how a delivery went: accepted (the card closes) or rejected (steps reopen). */
export default function DeliveryDrawer({
	card,
	userName,
	today,
	onSave,
	onClose,
}: {
	card: JobCard;
	userName: string;
	today: string;
	onSave: (draft: DeliveryDraft) => void | Promise<void>;
	onClose: () => void;
}) {
	const methods = useForm<Values>({ mode: "onTouched" });
	const rejected = useWatch({ control: methods.control, name: "outcome" }) === "rejected";

	const fields: FormFieldConfig[] = [
		{
			name: "outcome",
			type: "radio",
			label: "How did it go?",
			defaultValue: "accepted",
			options: [
				{
					value: "accepted",
					label: "Accepted: client signed for it. The job card closes.",
				},
				{
					value: "rejected",
					label: "Rejected: all or part came back. It goes back to a step for redo.",
				},
			],
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
			name: "by",
			type: "text",
			label: "Delivered by",
			defaultValue: userName,
			validation: validators.required("Who delivered it"),
		},
		...(rejected
			? ([
					{
						name: "what",
						type: "text",
						label: "What was rejected",
						description: "Item and how many",
						defaultValue: card.build[0] ? `${card.build[0].name} × 1` : "",
						validation: validators.required("What was rejected"),
					},
					{
						name: "reason",
						type: "select",
						label: "Reason",
						defaultValue: REJECTION_REASONS[0],
						options: REJECTION_REASONS.map((r) => ({ label: r, value: r })),
					},
					{
						name: "backTo",
						type: "select",
						label: "Send back to",
						description: "That step and every step after it reopen.",
						defaultValue: "3",
						options: STEP_NAMES.slice(0, DELIVERY_STEP).map((n, i) => ({
							label: n,
							value: String(i),
						})),
					},
				] satisfies FormFieldConfig[])
			: []),
		{
			name: "notes",
			type: "textarea",
			label: "Notes",
			placeholder: rejected
				? "e.g. Scratch on the top, left corner; client kept the sofa"
				: "e.g. Client signed; placed in the living room",
			defaultValue: "",
			rows: 3,
		},
		{
			name: "photos",
			type: "image",
			label: "Photos (optional)",
			description: rejected
				? `Up to ${MAX_PHOTOS_PER_UPLOAD} photos of the issue found at delivery (10 MB each)`
				: `Up to ${MAX_PHOTOS_PER_UPLOAD} signed delivery or installation photos (10 MB each)`,
			multiple: true,
			maxFiles: MAX_PHOTOS_PER_UPLOAD,
			maxSizeMB: 10,
			showPreview: true,
		},
	];

	return (
		<Drawer
			title="Record delivery"
			description={`${card.id} · ${card.address}`}
			onClose={onClose}
		>
			<MainForm<Values>
				methods={methods}
				fields={fields}
				rowPairs={[["date", "by"]]}
				hideRequiredMarks
				requireValidToSubmit={false}
				onSubmit={async (v) => {
					const uploaded = await resolveUploadedPhotos("job-cards", v.photos);
					if (!uploaded.ok) {
						toast.error(uploaded.message);
						return;
					}
					await onSave({
						outcome: v.outcome,
						date: dayjs(v.date).format("YYYY-MM-DD"),
						by: v.by.trim(),
						notes: v.notes?.trim() ?? "",
						photos: uploaded.urls,
						...(v.outcome === "rejected"
							? { what: v.what.trim(), reason: v.reason, backTo: Number(v.backTo) }
							: {}),
					});
				}}
				renderFooter={({ isLoading }) => (
					<div className="flex flex-wrap items-center gap-3">
						<span className="flex-1" />
						<Button onClick={onClose}>Cancel</Button>
						<Button type="submit" variant="primary" disabled={isLoading}>
							{isLoading
								? "Saving…"
								: rejected
									? "Record rejection"
									: "Record delivery"}
						</Button>
					</div>
				)}
			/>
		</Drawer>
	);
}
