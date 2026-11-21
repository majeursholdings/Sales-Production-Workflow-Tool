"use client";

import { useForm } from "react-hook-form";
import { Button } from "@/components/common/buttons";
import MainForm from "@/components/forms";
import type { FormFieldConfig } from "@/components/forms/types";
import { formatNaira } from "@/lib/currency";

export type PaymentValues = { amount: string; reference: string };

/** The form for recording a payment against what's still owing, shown inside the Payments card. The amount starts as the full balance. */
export default function RecordPaymentForm({
	balance,
	onRecord,
}: {
	balance: number;
	onRecord: (values: { amount: number; reference: string }) => void;
}) {
	// The amount input takes whole naira, so a balance with kobo is entered rounded down
	const methods = useForm<PaymentValues>({
		mode: "onTouched",
		defaultValues: { amount: String(Math.floor(balance)), reference: "" },
	});

	const fields: FormFieldConfig[] = [
		{
			name: "amount",
			type: "amount",
			label: "Amount received",
			defaultValue: String(Math.floor(balance)),
			description: `Balance due is ${formatNaira(balance)}.`,
			validation: {
				validate: (value: string) => {
					const amount = Number(value);
					if (!(amount > 0)) return "Enter an amount greater than ₦0.";
					if (amount > balance)
						return `That's more than the ${formatNaira(balance)} due.`;
					return true;
				},
			},
		},
		{
			name: "reference",
			type: "text",
			label: "Transfer reference",
			placeholder: "From the bank alert",
			validation: {
				validate: (v: string) => v.trim().length > 0 || "Enter the transfer reference.",
			},
		},
	];

	return (
		<section className="flex flex-col gap-4" aria-labelledby="record-payment-title">
			<h3 id="record-payment-title" className="text-h3 font-bold">
				Record balance payment
			</h3>
			<MainForm<PaymentValues>
				methods={methods}
				fields={fields}
				hideRequiredMarks
				requireValidToSubmit={false}
				onSubmit={(values) =>
					onRecord({ amount: Number(values.amount), reference: values.reference.trim() })
				}
				renderFooter={() => (
					<Button type="submit" variant="primary" className="w-full">
						Record payment
					</Button>
				)}
			/>
		</section>
	);
}
