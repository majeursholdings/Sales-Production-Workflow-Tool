"use client";

import { useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Button } from "@/components/common/buttons";
import { Callout } from "@/components/common/card";
import { Drawer } from "@/components/common/drawer";
import MainForm from "@/components/forms";
import { normalizeNigerianPhone, validators } from "@/components/forms/form.validators";
import type { FormFieldConfig } from "@/components/forms/types";
import { CLIENT_SOURCES, type Client } from "@/lib/clients";

type Values = {
	name: string;
	phone: string;
	email: string;
	address: string;
	birthday: string;
	preferredContact: string;
	source: string;
	sourceDetail: string;
	trade: boolean;
	company: string;
	notes: string;
};

const SOCIAL_PLATFORMS = [
	"Instagram",
	"TikTok",
	"Facebook",
	"X (Twitter)",
	"Pinterest",
	"LinkedIn",
].map((p) => ({
	label: p,
	value: p,
}));

/** The one extra question each "how did they come to Majeurs?" answer asks. */
function sourceDetailField(source: string): FormFieldConfig | null {
	switch (source) {
		case "Referral":
			return {
				name: "sourceDetail",
				type: "text",
				label: "Referred by",
				placeholder: "Search clients or type a name",
			};
		case "Social media":
			return {
				name: "sourceDetail",
				type: "select",
				label: "Which platform?",
				options: SOCIAL_PLATFORMS,
			};
		case "Local outreach":
			return {
				name: "sourceDetail",
				type: "text",
				label: "Event or campaign",
				placeholder: "e.g. Lagos Design Week 2026",
			};
		case "Other":
			return {
				name: "sourceDetail",
				type: "text",
				label: "Tell us more",
				placeholder: "Where did they hear about us?",
			};
		default:
			return null;
	}
}

/** The existing client this phone or email already belongs to, if any. */
function findDuplicate(clients: Client[], phone: string | undefined, email: string | undefined) {
	const phoneKey = phone ? normalizeNigerianPhone(phone) : null;
	const mail = email?.trim().toLowerCase();
	return clients.find(
		(c) => (phoneKey && c.phoneKey === phoneKey) || (mail && c.email.toLowerCase() === mail),
	);
}

export default function AddClientDrawer({
	clients,
	onAdd,
	onClose,
}: {
	clients: Client[];
	onAdd: (client: Client) => void;
	onClose: () => void;
}) {
	const methods = useForm<Values>({
		mode: "onTouched",
		defaultValues: { source: "Referral", trade: false, preferredContact: "WhatsApp" },
	});
	const [source, trade] = useWatch({ control: methods.control, name: ["source", "trade"] });

	const fields = useMemo<FormFieldConfig[]>(() => {
		const detail = sourceDetailField(source);
		return [
			{
				name: "name",
				type: "text",
				label: "Full name",
				placeholder: "As it should appear on quotes",
				validation: {
					required: "Full name is required",
					minLength: { value: 2, message: "Full name must be at least 2 characters" },
				},
			},
			{
				name: "phone",
				type: "tel",
				label: "Phone",
				placeholder: "0801 234 5678",
				autoComplete: "tel",
				validation: validators.phone(),
			},
			{
				name: "email",
				type: "email",
				label: "Email (optional)",
				placeholder: "name@example.com",
				autoComplete: "email",
				validation: {
					pattern: {
						value: /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,8}$/i,
						message: "Please enter a valid email address",
					},
				},
			},
			{
				name: "address",
				type: "text",
				label: "Delivery address",
				placeholder: "Street, area, city",
			},
			{
				name: "birthday",
				type: "text",
				label: "Birthday (optional)",
				placeholder: "Day and month",
			},
			{
				name: "preferredContact",
				type: "select",
				label: "Preferred contact",
				options: ["WhatsApp", "Phone call", "Email"].map((v) => ({ label: v, value: v })),
			},
			{
				name: "source",
				type: "radio",
				label: "How did they come to Majeurs?",
				options: CLIENT_SOURCES,
			},
			...(detail ? [detail] : []),
			{
				name: "trade",
				type: "checkbox",
				label: "Join the trade program (interior designers, architects and businesses buying for their clients)",
				defaultValue: false,
			},
			...(trade
				? [
						{
							name: "company",
							type: "text" as const,
							label: "Company name",
							placeholder: "Registered or trading name",
							description: "Shown on quotes and invoices.",
							validation: validators.required("Company name"),
						},
					]
				: []),
			{
				name: "notes",
				type: "textarea",
				label: "Notes (optional)",
				placeholder: "Preferences, access, measurements…",
				rows: 3,
			},
		];
	}, [source, trade]);

	const submit = (v: Values) => {
		const phoneKey = normalizeNigerianPhone(v.phone);
		onAdd({
			id: crypto.randomUUID(),
			name: v.name.trim(),
			contact: [v.phone.trim(), v.email?.trim()].filter(Boolean).join(" · "),
			phoneKey,
			email: v.email?.trim() ?? "",
			type: v.trade ? "Trade" : "Individual",
			company: v.trade ? v.company.trim() : "",
			location: v.address?.trim() ?? "",
			source: v.source,
			quotes: 0,
			spent: 0,
			last: "No quotes yet",
			tier: v.trade ? "Starter · no discount yet" : "",
		});
	};

	return (
		<Drawer
			title="Add new client"
			description="We check for duplicates by phone and email as you type."
			onClose={onClose}
		>
			<MainForm<Values>
				methods={methods}
				fields={fields}
				rowPairs={[
					["phone", "email"],
					["birthday", "preferredContact"],
				]}
				onSubmit={submit}
				hideRequiredMarks
				footerSlot={(values) => {
					const duplicate = findDuplicate(clients, values.phone, values.email);
					return (
						<>
							{duplicate && (
								<Callout
									role="alert"
									className="border border-warning-line bg-warning-subtle"
								>
									<span>
										<strong>
											That{" "}
											{duplicate.phoneKey &&
											duplicate.phoneKey ===
												normalizeNigerianPhone(values.phone ?? "")
												? "phone"
												: "email"}{" "}
											belongs to {duplicate.name}.
										</strong>{" "}
										Same person? Check their record instead, or carry on if
										it&apos;s shared.
									</span>
								</Callout>
							)}
							{values.trade && (
								<Callout>
									<span className="text-small text-fg-secondary">
										Starts at no discount. Spending is counted from today: 5%
										after ₦20M, 10% after ₦50M and 20% after ₦100M paid in the
										last 365 days.
									</span>
								</Callout>
							)}
						</>
					);
				}}
				renderFooter={({ isLoading, canSubmit }) => (
					<div className="flex flex-wrap items-center justify-end gap-3">
						<Button onClick={onClose}>Cancel</Button>
						<Button type="submit" variant="primary" disabled={isLoading || !canSubmit}>
							Add client
						</Button>
					</div>
				)}
			/>
		</Drawer>
	);
}
