"use client";

import dayjs from "dayjs";
import { useForm, useWatch } from "react-hook-form";
import type { NewJobCard } from "@/app/(dashboard)/work-orders/actions";
import { Button } from "@/components/common/buttons";
import { Drawer } from "@/components/common/drawer";
import MainForm from "@/components/forms";
import { validators } from "@/components/forms/form.validators";
import type { FormFieldConfig } from "@/components/forms/types";
import { qtyLabel } from "@/lib/inventory";
import { STEP_NAMES, parseHours, type PartOption, type QuoteOption } from "@/lib/jobCards";

type Values = {
	quoteId: string;
	due: string;
	address: string;
	note: string;
	parts: string[];
	[stepHours: `sh_${number}`]: string;
	[partQty: `pq_${number}`]: string;
};

const isoDay = (value: string) => dayjs(value).format("YYYY-MM-DD");

/** Start a job card from a quote whose deposit is paid. Its parts are reserved from stock straight away. */
export default function NewJobCardDrawer({
	quotes,
	parts,
	today,
	onSave,
	onClose,
}: {
	/** Quotes with their deposit paid and no job card yet. */
	quotes: QuoteOption[];
	parts: PartOption[];
	today: string;
	onSave: (card: NewJobCard) => void | Promise<void>;
	onClose: () => void;
}) {
	const methods = useForm<Values>({ mode: "onTouched", defaultValues: { parts: [] } });
	const quoteId = useWatch({ control: methods.control, name: "quoteId" });
	const picked = useWatch({ control: methods.control, name: "parts" }) ?? [];
	const quote = quotes.find((q) => q.id === quoteId);
	const partOf = (sku: string) => parts.find((p) => p.sku === sku);

	const fields: FormFieldConfig[] = [
		{
			name: "quoteId",
			type: "combobox",
			label: "Quote",
			placeholder: "Pick a quote",
			emptyMessage: "No quote with a paid deposit matches",
			defaultValue: quotes.length === 1 ? quotes[0].id : "",
			options: quotes.map((q) => ({ value: q.id, label: `${q.number} · ${q.client}` })),
			validation: validators.required("Quote"),
		},
		{
			name: "due",
			type: "date",
			label: "Due",
			minDate: today,
			defaultValue: dayjs(today).add(21, "day").format("YYYY-MM-DD"),
			validation: validators.required("Due date"),
		},
		{
			name: "address",
			type: "textarea",
			label: "Delivery address",
			description: quote?.address
				? `Leave blank to use the client's location: ${quote.address}`
				: undefined,
			placeholder: "e.g. 14 Admiralty Way, Lekki Phase 1, Lagos",
			defaultValue: "",
			rows: 2,
			validation: {
				validate: (v: string) =>
					!!(v ?? "").trim() || !!quote?.address || "Enter the delivery address",
			},
		},
		{
			name: "note",
			type: "textarea",
			label: "Note from customer care (optional)",
			placeholder: "e.g. Fabric from one dye lot only. Client is home after 3pm.",
			defaultValue: "",
			rows: 2,
		},
		...STEP_NAMES.map((step, i): FormFieldConfig => ({
			name: `sh_${i}`,
			type: "text",
			label: `${step}: planned hours`,
			inputMode: "decimal",
			defaultValue: "0",
			validation: {
				validate: (v: string) =>
					parseHours(v) >= 0 || "Enter the hours, e.g. 6 (0 if none)",
			},
		})),
		{
			name: "parts",
			type: "multiselect",
			label: "Parts to pick",
			description: parts.length
				? "What's free in stock is reserved for this job card; anything short shows for procurement."
				: "No parts in inventory yet.",
			placeholder: "No parts",
			options: parts.map((p) => ({
				value: p.sku,
				label: `${p.name} · ${qtyLabel(Math.max(0, p.available), p.unit)} free`,
			})),
		},
		...picked.map((sku, i): FormFieldConfig => ({
			name: `pq_${i}`,
			type: "text",
			label: `${partOf(sku)?.name ?? sku}: quantity (${partOf(sku)?.unit ?? "units"})`,
			inputMode: "decimal",
			defaultValue: "",
			validation: {
				validate: (v: string) => parseHours(v) > 0 || "Enter how many are needed",
			},
		})),
	];

	return (
		<Drawer
			title="New job card"
			description="From a quote whose deposit is paid. Items come from the quote."
			onClose={onClose}
		>
			{quote && (
				<div className="flex flex-col gap-1 rounded-md bg-subtle px-4 py-3">
					<strong className="text-small text-fg-secondary">What to build</strong>
					<ul className="flex flex-col text-body text-fg">
						{quote.items.map((item, i) => (
							<li key={`${item.name}-${i}`}>
								{item.name} × {item.qty}
								{item.spec && (
									<span className="text-small text-fg-tertiary">
										{" "}
										· {item.spec}
									</span>
								)}
							</li>
						))}
					</ul>
				</div>
			)}
			<MainForm<Values>
				methods={methods}
				fields={fields}
				rowPairs={[
					["sh_0", "sh_1"],
					["sh_2", "sh_3"],
					["sh_4", "sh_5"],
				]}
				hideRequiredMarks
				requireValidToSubmit={false}
				onSubmit={(v) =>
					onSave({
						quoteId: v.quoteId,
						due: isoDay(v.due),
						address: v.address?.trim() || quote?.address || "",
						note: v.note?.trim() ?? "",
						plannedHours: STEP_NAMES.map((_, i) => parseHours(v[`sh_${i}`]) || 0),
						parts: (v.parts ?? []).map((sku, i) => ({
							sku,
							qty: parseHours(v[`pq_${i}`]),
						})),
					})
				}
				renderFooter={({ isLoading }) => (
					<div className="flex flex-wrap items-center justify-end gap-3">
						<Button onClick={onClose}>Cancel</Button>
						<Button type="submit" variant="primary" disabled={isLoading}>
							Start job card
						</Button>
					</div>
				)}
			/>
		</Drawer>
	);
}
