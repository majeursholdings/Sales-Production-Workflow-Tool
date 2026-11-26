"use client";

import { useForm } from "react-hook-form";
import MainForm from "@/components/forms";
import { validators } from "@/components/forms/form.validators";
import type { FormFieldConfig } from "@/components/forms/types";
import type { BankDetails, CompanySettings, DocumentTerms } from "@/lib/companySettings";
import {
	saveBankDetailsAction,
	saveDocumentTermsAction,
} from "@/app/(dashboard)/(settings)/settings/actions";
import { optionalAccountNumber } from "./rules";
import { RecentChanges, SaveRow, SettingsCard, lockFields, useSettingsSave } from "./settingsCard";

const bankFields: FormFieldConfig[] = [
	{ name: "ngnBank", type: "text", label: "Naira account: bank", placeholder: "e.g. GTBank" },
	{
		name: "ngnAccountName",
		type: "text",
		label: "Account name",
		validation: validators.required("Account name"),
	},
	{
		name: "ngnAccountNumber",
		type: "text",
		label: "Account number",
		inputMode: "numeric",
		placeholder: "10 digits",
		validation: optionalAccountNumber,
	},
	{
		name: "usdBank",
		type: "text",
		label: "Dollar account: bank",
		placeholder: "e.g. Zenith Bank",
	},
	{
		name: "usdAccountNumber",
		type: "text",
		label: "Dollar account number",
		inputMode: "numeric",
		placeholder: "10 digits",
		validation: optionalAccountNumber,
	},
	{
		name: "swift",
		type: "text",
		label: "SWIFT code (optional)",
		placeholder: "For international transfers",
		validation: {
			validate: (v: string) =>
				!v?.trim() ||
				/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/i.test(v.trim()) ||
				"SWIFT codes are 8 or 11 letters and numbers",
		},
	},
];

const termsFields: FormFieldConfig[] = [
	{
		name: "quoteTerms",
		type: "textarea",
		label: "Quote terms",
		rows: 5,
		validation: validators.required("Quote terms"),
	},
	{ name: "invoiceFooter", type: "textarea", label: "Invoice footer", rows: 3 },
];

/** Bank & terms: the accounts clients pay into and the terms printed on quotes and invoices. */
export default function BankTermsPanel({
	settings,
	now,
	canEdit,
}: {
	settings: CompanySettings;
	now: string;
	/** MD or GM. Accounting sees the settings read-only. */
	canEdit: boolean;
}) {
	const readOnly = !canEdit;
	const bankSave = useSettingsSave();
	const termsSave = useSettingsSave();
	const bankForm = useForm<BankDetails>({ mode: "onTouched", defaultValues: settings.bank });
	const termsForm = useForm<DocumentTerms>({ mode: "onTouched", defaultValues: settings.terms });

	return (
		<>
			<SettingsCard
				readOnly={readOnly}
				title="Bank details for payment"
				description="Shown on quotes and invoices under “How to pay”. Clients paying in USD see the dollar account."
			>
				<MainForm<BankDetails>
					methods={bankForm}
					fields={lockFields(bankFields, readOnly)}
					rowPairs={[
						["ngnBank", "ngnAccountName"],
						["usdBank", "usdAccountNumber"],
					]}
					hideRequiredMarks
					requireValidToSubmit={false}
					onSubmit={(v) => {
						const next: BankDetails = {
							ngnBank: v.ngnBank.trim(),
							ngnAccountName: v.ngnAccountName.trim(),
							ngnAccountNumber: v.ngnAccountNumber.replace(/\s/g, ""),
							usdBank: v.usdBank.trim(),
							usdAccountNumber: v.usdAccountNumber.replace(/\s/g, ""),
							swift: v.swift.trim().toUpperCase(),
						};
						bankSave.save(
							() => saveBankDetailsAction(next),
							"Bank details saved. New quotes and invoices show them.",
							() => bankForm.reset(next),
						);
					}}
					renderFooter={() => (readOnly ? null : <SaveRow saving={bankSave.saving} />)}
				/>
			</SettingsCard>

			<SettingsCard readOnly={readOnly} title="Terms on documents">
				<MainForm<DocumentTerms>
					methods={termsForm}
					fields={lockFields(termsFields, readOnly)}
					hideRequiredMarks
					requireValidToSubmit={false}
					onSubmit={(v) => {
						const next: DocumentTerms = {
							quoteTerms: v.quoteTerms.trim(),
							invoiceFooter: v.invoiceFooter.trim(),
						};
						termsSave.save(
							() => saveDocumentTermsAction(next),
							"Terms saved. Quotes already sent keep the terms they had.",
							() => termsForm.reset(next),
						);
					}}
					renderFooter={() => (readOnly ? null : <SaveRow saving={termsSave.saving} />)}
				/>
			</SettingsCard>

			<RecentChanges changes={settings.changes} now={now} />
		</>
	);
}
