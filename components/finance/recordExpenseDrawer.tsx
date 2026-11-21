"use client";

import { useForm } from "react-hook-form";
import { Button } from "@/components/common/buttons";
import { Callout } from "@/components/common/card";
import { Drawer } from "@/components/common/drawer";
import MainForm from "@/components/forms";
import { validators } from "@/components/forms/form.validators";
import type { FormFieldConfig } from "@/components/forms/types";
import {
	CATEGORY_LABELS,
	PAYMENT_METHODS,
	RECORDABLE_CATEGORIES,
	type FinanceCategory,
} from "@/lib/finance";

export type ExpenseValues = {
	date: string;
	category: FinanceCategory;
	amount: string;
	paidTo: string;
	method: string;
	reference: string;
	note: string;
};

/** Right-hand drawer for recording a running cost (wages, rent, power, delivery…). */
export default function RecordExpenseDrawer({
	today,
	earliest,
	onSave,
	onClose,
}: {
	today: string;
	earliest: string;
	onSave: (values: ExpenseValues) => void;
	onClose: () => void;
}) {
	const methods = useForm<ExpenseValues>({
		mode: "onTouched",
		defaultValues: {
			date: today,
			category: "del",
			amount: "",
			paidTo: "",
			method: "transfer",
			reference: "",
			note: "",
		},
	});

	const fields: FormFieldConfig[] = [
		{
			name: "date",
			type: "date",
			label: "Date paid",
			defaultValue: today,
			minDate: earliest,
			maxDate: today,
			validation: validators.required("Date paid"),
		},
		{
			name: "category",
			type: "select",
			label: "Category",
			defaultValue: "del",
			options: RECORDABLE_CATEGORIES.map((value) => ({
				value,
				label: CATEGORY_LABELS[value],
			})),
		},
		{
			name: "amount",
			type: "amount",
			label: "Amount (₦), VAT included",
			placeholder: "0",
			validation: {
				validate: (value: string) =>
					Number(value) > 0 || "Enter an amount greater than ₦0.",
			},
		},
		{
			name: "paidTo",
			type: "text",
			label: "Paid to",
			placeholder: "Person or business",
			validation: { validate: (v: string) => v.trim().length > 0 || "Enter who was paid." },
		},
		{
			name: "method",
			type: "select",
			label: "Payment method",
			defaultValue: "transfer",
			options: PAYMENT_METHODS.map(({ value, label }) => ({ value, label })),
		},
		{
			name: "reference",
			type: "text",
			label: "Reference (optional)",
			placeholder: "Bank or receipt number",
		},
		{
			name: "note",
			type: "textarea",
			label: "Note (optional)",
			placeholder: "What it was for",
			rows: 3,
		},
	];

	return (
		<Drawer
			title="Record expense"
			description="For wages, rent, power, delivery and other running costs."
			onClose={onClose}
		>
			<Callout className="border border-info-line bg-info-subtle text-info-fg">
				Payments to suppliers for materials are recorded on the purchase order and counted
				here automatically. Don&apos;t record them again.
			</Callout>
			<MainForm<ExpenseValues>
				methods={methods}
				fields={fields}
				rowPairs={[
					["date", "category"],
					["method", "reference"],
				]}
				hideRequiredMarks
				requireValidToSubmit={false}
				onSubmit={onSave}
				renderFooter={() => (
					<div className="flex flex-wrap items-center justify-end gap-3">
						<Button onClick={onClose}>Cancel</Button>
						<Button type="submit" variant="primary">
							Save expense
						</Button>
					</div>
				)}
			/>
		</Drawer>
	);
}
