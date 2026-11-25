"use client";

import Image from "next/image";
import dayjs from "dayjs";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import MainForm from "@/components/forms";
import type { FileFieldValue } from "@/components/forms/fileInput";
import { validators } from "@/components/forms/form.validators";
import type { FormFieldConfig } from "@/components/forms/types";
import { IDLE_OPTIONS, type CompanySettings } from "@/lib/companySettings";
import { saveCompanySettings, useCompanySettings } from "@/lib/companySettingsStore";
import { optionalPhone } from "./rules";
import { RecentChanges, SaveRow, SettingsCard, lockFields } from "./settingsCard";

type DetailsValues = {
	logo: FileFieldValue[];
	tradingName: string;
	registeredName: string;
	rcNumber: string;
	tin: string;
	address: string;
	phone: string;
	whatsapp: string;
	website: string;
};

type SignInValues = { requireTwoStep: boolean; idleHours: string };

/** Company details: the name, numbers and contacts printed on every document, and sign-in rules for everyone. */
export default function CompanyDetailsPanel({
	initial,
	userName,
	now,
	canEdit,
}: {
	initial: CompanySettings;
	userName: string;
	now: string;
	/** MD or GM. Accounting sees the settings read-only. */
	canEdit: boolean;
}) {
	const settings = useCompanySettings(initial);
	const readOnly = !canEdit;
	const { details, signIn } = settings;

	const detailsForm = useForm<DetailsValues>({
		mode: "onTouched",
		defaultValues: {
			...details,
			logo: [{ id: "logo", url: details.logoUrl, name: "Document logo", kind: "image" }],
		},
	});
	const signInForm = useForm<SignInValues>({
		defaultValues: {
			requireTwoStep: signIn.requireTwoStep,
			idleHours: String(signIn.idleHours),
		},
	});

	const detailFields: FormFieldConfig[] = [
		{
			name: "logo",
			type: "image",
			label: "Document logo",
			description: "Charcoal lockup, SVG or PNG at least 600 px wide.",
			accept: "image/png, image/svg+xml",
			maxFiles: 1,
			showPreview: true,
		},
		{
			name: "tradingName",
			type: "text",
			label: "Trading name",
			validation: validators.required("Trading name"),
		},
		{
			name: "registeredName",
			type: "text",
			label: "Registered name",
			validation: validators.required("Registered name"),
		},
		{ name: "rcNumber", type: "text", label: "RC number", placeholder: "e.g. RC 1234567" },
		{ name: "tin", type: "text", label: "TIN", placeholder: "e.g. 12345678-0001" },
		{
			name: "address",
			type: "textarea",
			label: "Showroom and workshop address",
			placeholder: "Street, area, city",
			rows: 3,
			description: "Printed in the footer of every document.",
		},
		{
			name: "phone",
			type: "tel",
			label: "Phone",
			placeholder: "0801 234 5678",
			validation: optionalPhone,
		},
		{
			name: "whatsapp",
			type: "tel",
			label: "WhatsApp business number",
			placeholder: "0801 234 5678",
			validation: optionalPhone,
		},
		{
			name: "website",
			type: "text",
			label: "Website",
			placeholder: "majeursholdings.com",
			validation: validators.url(),
		},
	];

	const signInFields: FormFieldConfig[] = [
		{
			name: "requireTwoStep",
			type: "checkbox",
			label: (
				<span className="flex flex-col">
					<strong>Require two-step verification for every role</strong>
					<span className="text-small text-fg-secondary">
						From {dayjs(signIn.twoStepFrom).format("D MMM YYYY")}. People without it are
						asked to set it up at their next sign-in.
					</span>
				</span>
			),
		},
		{
			name: "idleHours",
			type: "select",
			label: "Sign people out after",
			options: IDLE_OPTIONS,
			className: "max-w-72",
			validation: validators.required("Sign-out time"),
		},
	];

	return (
		<>
			<SettingsCard readOnly={readOnly} title="Company details">
				{readOnly && (
					<div className="flex items-center gap-4">
						<span className="grid h-16 w-40 place-items-center rounded-md border border-line bg-surface">
							<Image
								src={details.logoUrl}
								alt={`${details.tradingName} logo`}
								width={116}
								height={32}
								unoptimized
								className="h-8 w-29 object-contain"
							/>
						</span>
						<span className="flex flex-col text-body">
							<strong>Document logo</strong>
							<span className="text-small text-fg-secondary">
								Printed on quotes, invoices and purchase orders.
							</span>
						</span>
					</div>
				)}
				<MainForm<DetailsValues>
					methods={detailsForm}
					fields={
						readOnly
							? lockFields(
									detailFields.filter((f) => f.name !== "logo"),
									true,
								)
							: detailFields
					}
					rowPairs={[
						["tradingName", "registeredName"],
						["rcNumber", "tin"],
						["phone", "whatsapp"],
					]}
					hideRequiredMarks
					requireValidToSubmit={false}
					onSubmit={(v) => {
						const logo = v.logo?.[0];
						saveCompanySettings(
							{
								details: {
									tradingName: v.tradingName.trim(),
									registeredName: v.registeredName.trim(),
									rcNumber: v.rcNumber.trim(),
									tin: v.tin.trim(),
									address: v.address.trim(),
									phone: v.phone.trim(),
									whatsapp: v.whatsapp.trim(),
									website: v.website.trim(),
									logoUrl:
										logo instanceof File
											? URL.createObjectURL(logo)
											: (logo?.url ?? details.logoUrl),
								},
							},
							{ by: userName, what: "Updated company details" },
						);
						toast.success("Company details saved. New documents use them from now on.");
					}}
					renderFooter={() => (readOnly ? null : <SaveRow />)}
				/>
			</SettingsCard>

			<SettingsCard readOnly={readOnly} title="Sign-in security for everyone">
				<MainForm<SignInValues>
					methods={signInForm}
					fields={lockFields(signInFields, readOnly)}
					hideRequiredMarks
					requireValidToSubmit={false}
					onSubmit={(v) => {
						saveCompanySettings(
							{
								signIn: {
									...signIn,
									requireTwoStep: v.requireTwoStep,
									idleHours: Number(v.idleHours),
								},
							},
							{
								by: userName,
								what: v.requireTwoStep
									? `Set sign-in rules: two-step verification for every role, sign out after ${v.idleHours} hours`
									: `Set sign-in rules: two-step verification optional, sign out after ${v.idleHours} hours`,
							},
						);
						toast.success(
							"Sign-in rules saved. They apply at everyone's next sign-in.",
						);
					}}
					renderFooter={() => (readOnly ? null : <SaveRow />)}
				/>
			</SettingsCard>

			<RecentChanges changes={settings.changes} now={now} />
		</>
	);
}
