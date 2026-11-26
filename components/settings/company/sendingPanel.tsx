"use client";

import { useForm } from "react-hook-form";
import type { RegisterOptions } from "react-hook-form";
import MainForm from "@/components/forms";
import { validators } from "@/components/forms/form.validators";
import type { FormFieldConfig } from "@/components/forms/types";
import {
	MESSAGE_PLACEHOLDERS,
	unknownPlaceholders,
	type CompanySettings,
	type SendingSettings,
} from "@/lib/companySettings";
import { saveSendingAction } from "@/app/(dashboard)/(settings)/settings/actions";
import { RecentChanges, SaveRow, SettingsCard, lockFields, useSettingsSave } from "./settingsCard";

const placeholderList = MESSAGE_PLACEHOLDERS.map((p) => `{${p}}`).join(", ");

/** A message that only uses placeholders we can fill in. */
const messageRule = (label: string): RegisterOptions => ({
	required: `${label} is required`,
	validate: (v: string) => {
		const unknown = unknownPlaceholders(v ?? "");
		return (
			unknown.length === 0 ||
			`We can't fill in ${unknown.map((u) => `{${u}}`).join(", ")}. Use ${placeholderList}.`
		);
	},
});

const fields: FormFieldConfig[] = [
	{
		name: "fromEmail",
		type: "email",
		label: "Send emails from",
		description: "Replies go to the person who prepared the quote.",
		validation: validators.email(),
	},
	{
		name: "senderName",
		type: "text",
		label: "Sender name",
		validation: validators.required("Sender name"),
	},
	{
		name: "quoteEmail",
		type: "textarea",
		label: "Quote email message",
		rows: 5,
		description: `Placeholders in braces fill in automatically: ${placeholderList}.`,
		validation: messageRule("Quote email message"),
	},
	{
		name: "whatsappMessage",
		type: "textarea",
		label: "WhatsApp message",
		rows: 3,
		validation: messageRule("WhatsApp message"),
	},
	{
		name: "ccAccountingOnInvoices",
		type: "checkbox",
		label: "Copy Accounting on every invoice email",
	},
];

/** Email & WhatsApp: who quotes and invoices come from, and the messages sent with them. */
export default function SendingPanel({
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
	const { saving, save } = useSettingsSave();
	const form = useForm<SendingSettings>({ mode: "onTouched", defaultValues: settings.sending });

	return (
		<>
			<SettingsCard readOnly={readOnly} title="Sending quotes and invoices">
				<MainForm<SendingSettings>
					methods={form}
					fields={lockFields(fields, readOnly)}
					rowPairs={[["fromEmail", "senderName"]]}
					hideRequiredMarks
					requireValidToSubmit={false}
					onSubmit={(v) => {
						const next: SendingSettings = {
							fromEmail: v.fromEmail.trim(),
							senderName: v.senderName.trim(),
							quoteEmail: v.quoteEmail.trim(),
							whatsappMessage: v.whatsappMessage.trim(),
							ccAccountingOnInvoices: v.ccAccountingOnInvoices,
						};
						save(
							() => saveSendingAction(next),
							"Saved. Quotes and invoices sent from now use these messages.",
							() => form.reset(next),
						);
					}}
					renderFooter={() => (readOnly ? null : <SaveRow saving={saving} />)}
				/>
			</SettingsCard>

			<RecentChanges changes={settings.changes} now={now} />
		</>
	);
}
