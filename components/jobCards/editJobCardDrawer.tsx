"use client";

import dayjs from "dayjs";
import { useForm, useWatch } from "react-hook-form";
import type { JobCardDetails } from "@/app/(dashboard)/work-orders/actions";
import { Button } from "@/components/common/buttons";
import { Drawer } from "@/components/common/drawer";
import MainForm from "@/components/forms";
import { validators } from "@/components/forms/form.validators";
import type { FormFieldConfig } from "@/components/forms/types";
import type { JobCard } from "@/lib/jobCards";

type Values = {
	due: string;
	address: string;
	note: string;
	booked: boolean;
	bookedFor: string;
};

const isoDay = (value: string) => dayjs(value).format("YYYY-MM-DD");

/** Change a job card's due date, delivery address and note, and book its delivery. */
export default function EditJobCardDrawer({
	card,
	today,
	onSave,
	onClose,
}: {
	card: JobCard;
	today: string;
	onSave: (details: JobCardDetails) => void | Promise<void>;
	onClose: () => void;
}) {
	const methods = useForm<Values>({ mode: "onTouched" });
	const booked = useWatch({ control: methods.control, name: "booked" });

	const fields: FormFieldConfig[] = [
		{
			name: "due",
			type: "date",
			label: "Due",
			defaultValue: card.due,
			validation: validators.required("Due date"),
		},
		{
			name: "address",
			type: "textarea",
			label: "Delivery address",
			defaultValue: card.address,
			rows: 2,
			validation: validators.required("Delivery address"),
		},
		{
			name: "note",
			type: "textarea",
			label: "Note from customer care",
			placeholder: "e.g. Client is home after 3pm",
			defaultValue: card.note,
			rows: 3,
		},
		{
			name: "booked",
			type: "checkbox",
			label: "Delivery is booked",
			defaultValue: card.delivery.state === "booked",
		},
		...(booked
			? ([
					{
						name: "bookedFor",
						type: "date",
						label: "Booked for",
						minDate: today,
						defaultValue:
							card.delivery.bookedFor ?? (card.due < today ? today : card.due),
						validation: validators.required("Delivery date"),
					},
				] satisfies FormFieldConfig[])
			: []),
	];

	return (
		<Drawer title="Edit job card" description={`${card.id} · ${card.client}`} onClose={onClose}>
			<MainForm<Values>
				methods={methods}
				fields={fields}
				hideRequiredMarks
				requireValidToSubmit={false}
				onSubmit={(v) =>
					onSave({
						due: isoDay(v.due),
						address: v.address.trim(),
						note: v.note?.trim() ?? "",
						bookedFor: v.booked && v.bookedFor ? isoDay(v.bookedFor) : null,
					})
				}
				renderFooter={({ isLoading }) => (
					<div className="flex flex-wrap items-center justify-end gap-3">
						<Button onClick={onClose}>Cancel</Button>
						<Button type="submit" variant="primary" disabled={isLoading}>
							Save changes
						</Button>
					</div>
				)}
			/>
		</Drawer>
	);
}
