"use client";

import dayjs from "dayjs";
import { useForm, useWatch } from "react-hook-form";
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

type Values = {
	outcome: "accepted" | "rejected";
	date: string;
	by: string;
	what: string;
	reason: string;
	backTo: string;
	notes: string;
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
	onSave: (draft: DeliveryDraft) => void;
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
						defaultValue: `${card.build[0].name} × 1`,
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
				onSubmit={(v) =>
					onSave({
						outcome: v.outcome,
						date: dayjs(v.date).format("YYYY-MM-DD"),
						by: v.by.trim(),
						notes: v.notes?.trim() ?? "",
						...(v.outcome === "rejected"
							? { what: v.what.trim(), reason: v.reason, backTo: Number(v.backTo) }
							: {}),
					})
				}
				renderFooter={() => (
					<div className="flex flex-wrap items-center gap-3">
						<span className="min-w-0 flex-1 text-small text-fg-tertiary">
							Photo upload isn&apos;t connected yet.
						</span>
						<Button onClick={onClose}>Cancel</Button>
						<Button type="submit" variant="primary">
							{rejected ? "Record rejection" : "Record delivery"}
						</Button>
					</div>
				)}
			/>
		</Drawer>
	);
}
