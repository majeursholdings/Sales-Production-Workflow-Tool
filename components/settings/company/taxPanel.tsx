"use client";

import dayjs from "dayjs";
import { useForm, useWatch } from "react-hook-form";
import MainForm from "@/components/forms";
import type { FormFieldConfig } from "@/components/forms/types";
import { ROUNDING_OPTIONS, type CompanySettings, type DollarRate } from "@/lib/companySettings";
import { saveDollarRateAction, saveTaxAction } from "@/app/(dashboard)/(settings)/settings/actions";
import { formatNaira } from "@/lib/currency";
import { pct, percentOf, percentRule, wholeRule } from "./rules";
import { RecentChanges, SaveRow, SettingsCard, lockFields, useSettingsSave } from "./settingsCard";

type TaxValues = {
	vat: string;
	deposit: string;
	validity: string;
	poLimit: string;
};

type RateValues = { rate: string; rounding: DollarRate["rounding"] };

const naira = (n: number) => `₦${Math.round(n).toLocaleString("en-NG")}`;

/** Tax & currency: VAT, deposit, quote validity, PO approval limit, and today's dollar rate. */
export default function TaxPanel({
	settings,
	now,
	canEdit,
	canEditRate,
}: {
	settings: CompanySettings;
	now: string;
	/** MD or GM. Accounting sees the settings read-only. */
	canEdit: boolean;
	/** Anyone who edits pricing rules (MD, GM, Accounting) sets the daily dollar rate. */
	canEditRate: boolean;
}) {
	const readOnly = !canEdit;
	const rateReadOnly = !canEditRate;
	const taxSave = useSettingsSave();
	const rateSave = useSettingsSave();
	const { tax, dollar } = settings;

	const taxForm = useForm<TaxValues>({
		mode: "onTouched",
		defaultValues: {
			vat: pct(tax.vatPercent),
			deposit: pct(tax.depositPercent),
			validity: String(tax.quoteValidityDays),
			poLimit: String(tax.poApprovalLimit),
		},
	});
	const rateForm = useForm<RateValues>({
		mode: "onTouched",
		defaultValues: { rate: dollar.rate.toFixed(2), rounding: dollar.rounding },
	});

	const deposit = percentOf(useWatch({ control: taxForm.control, name: "deposit" }));
	const depositNote =
		Number.isFinite(deposit) && deposit > 0 && deposit <= 100
			? `On a ₦1,000,000 quote the client pays ${naira(deposit * 10000)} upfront and ${naira((100 - deposit) * 10000)} before delivery. Applies to new quotes; sent quotes keep their deposit.`
			: "Enter a percentage between 1 and 100.";

	const rateSet = dayjs(dollar.setAt);
	const rateNote = !dollar.setAt
		? "Not changed since setup."
		: `Set by ${dollar.setBy || "someone no longer on the team"} ${
				rateSet.isSame(dayjs(now), "day")
					? `at ${rateSet.format("HH:mm")} today`
					: `on ${rateSet.format("D MMM YYYY, HH:mm")}`
			}.`;

	const taxFields: FormFieldConfig[] = [
		{
			name: "vat",
			type: "text",
			label: "VAT rate",
			inputMode: "decimal",
			description: "Added after markup and trade discounts.",
			validation: percentRule("VAT rate"),
		},
		{
			name: "deposit",
			type: "text",
			label: "Deposit to confirm an order",
			inputMode: "decimal",
			description: depositNote,
			validation: percentRule("Deposit", 1, 100),
		},
		{
			name: "validity",
			type: "text",
			label: "Quote validity (days)",
			inputMode: "numeric",
			description: "How long a sent quote holds its price.",
			validation: wholeRule("Quote validity"),
		},
		{
			name: "poLimit",
			type: "amount",
			label: "PO approval above",
			currencySymbol: "₦",
			description: "Purchase orders over this need MD or GM approval.",
			validation: { validate: (v: string) => Number(v) > 0 || "Enter an amount above ₦0" },
		},
	];

	const rateFields: FormFieldConfig[] = [
		{
			name: "rate",
			type: "text",
			label: "Today's rate (₦ per $1)",
			inputMode: "decimal",
			description: rateNote,
			validation: {
				required: "Enter today's rate",
				validate: (v: string) =>
					Number(String(v).replace(/,/g, "")) > 0 || "Enter a rate above ₦0",
			},
		},
		{
			name: "rounding",
			type: "select",
			label: "Rounding for dollar prices",
			options: ROUNDING_OPTIONS,
			validation: { required: "Pick a rounding" },
		},
	];

	return (
		<>
			<SettingsCard readOnly={readOnly} title="Tax, deposit and validity">
				<MainForm<TaxValues>
					methods={taxForm}
					fields={lockFields(taxFields, readOnly)}
					rowPairs={[
						["vat", "deposit"],
						["validity", "poLimit"],
					]}
					hideRequiredMarks
					requireValidToSubmit={false}
					onSubmit={(v) => {
						const next = {
							vatPercent: percentOf(v.vat),
							depositPercent: percentOf(v.deposit),
							quoteValidityDays: Number(v.validity),
							poApprovalLimit: Number(v.poLimit),
						};
						taxSave.save(
							() => saveTaxAction(next),
							"Saved. New quotes and purchase orders use this from now on.",
							() =>
								taxForm.reset({
									vat: pct(next.vatPercent),
									deposit: pct(next.depositPercent),
									validity: String(next.quoteValidityDays),
									poLimit: String(next.poApprovalLimit),
								}),
						);
					}}
					renderFooter={() => (readOnly ? null : <SaveRow saving={taxSave.saving} />)}
				/>
			</SettingsCard>

			<SettingsCard
				readOnly={rateReadOnly}
				title="US dollar rate"
				description="Quotes are built in naira. When a quote is sent in dollars, today's rate is locked onto it."
			>
				<MainForm<RateValues>
					methods={rateForm}
					fields={lockFields(rateFields, rateReadOnly)}
					rowPairs={[["rate", "rounding"]]}
					hideRequiredMarks
					requireValidToSubmit={false}
					onSubmit={(v) => {
						const rate = Number(v.rate.replace(/,/g, ""));
						rateSave.save(
							() => saveDollarRateAction({ rate, rounding: v.rounding }),
							`Dollar rate set to ${formatNaira(rate)}. Quotes sent in USD from now lock it.`,
							() => rateForm.reset({ rate: rate.toFixed(2), rounding: v.rounding }),
						);
					}}
					renderFooter={() =>
						rateReadOnly ? null : <SaveRow saving={rateSave.saving} />
					}
				/>
			</SettingsCard>

			<RecentChanges changes={settings.changes} now={now} />
		</>
	);
}
