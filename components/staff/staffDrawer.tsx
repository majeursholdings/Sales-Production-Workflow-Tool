"use client";

import { useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Button } from "@/components/common/buttons";
import { Drawer } from "@/components/common/drawer";
import MainForm from "@/components/forms";
import { validators } from "@/components/forms/form.validators";
import type { FormFieldConfig } from "@/components/forms/types";
import {
	DEFAULT_HOURS,
	NON_PRODUCTION_ROLES,
	PRODUCTION_ROLES,
	type StaffMember,
	type StaffTeam,
} from "@/lib/staff";

type Values = {
	name: string;
	phone: string;
	email: string;
	team: StaffTeam;
	role: string;
	rate: string;
	hours: string;
	notes: string;
};

const toNumber = (v: string) => Number(String(v).replace(/[^0-9.]/g, "")) || 0;

/** Add a staff member, or edit one (their team can't change once they're added). */
export default function StaffDrawer({
	person,
	defaultTeam,
	onSave,
	onRemove,
	onClose,
}: {
	/** The person being edited; leave out to add someone. */
	person?: StaffMember;
	/** The team an added person starts in. */
	defaultTeam: StaffTeam;
	onSave: (person: StaffMember) => void;
	onRemove?: () => void;
	onClose: () => void;
}) {
	const methods = useForm<Values>({
		mode: "onTouched",
		defaultValues: { team: person?.team ?? defaultTeam },
	});
	const team = useWatch({ control: methods.control, name: "team" });

	const fields = useMemo<FormFieldConfig[]>(() => {
		const roles = team === "Production" ? PRODUCTION_ROLES : NON_PRODUCTION_ROLES;
		return [
			{
				name: "name",
				type: "text",
				label: "Full name",
				placeholder: "As on payroll",
				defaultValue: person?.name ?? "",
				validation: validators.required("Full name"),
			},
			{
				name: "phone",
				type: "tel",
				label: "Phone number",
				placeholder: "0801 234 5678",
				defaultValue: person?.phone ?? "",
				validation: validators.phone(),
			},
			{
				name: "email",
				type: "email",
				label: "Email",
				placeholder: "name@majeursholdings.com",
				defaultValue: person?.email ?? "",
				validation: validators.email(),
			},
			{
				name: "team",
				type: "radio",
				label: "Team",
				disabled: !!person,
				defaultValue: person?.team ?? defaultTeam,
				description: person
					? "A person's team can't be changed. Remove and re-add them to move teams."
					: undefined,
				options: [
					{
						label: "Production: builds the furniture, charged by the hour on each piece",
						value: "Production",
					},
					{
						label: "Non-production: backend team, shared through the workshop overhead",
						value: "Non-production",
					},
				],
			},
			{
				name: "role",
				type: "select",
				label: "Role",
				defaultValue: person && person.team === team ? person.role : roles[0],
				options: roles.map((r) => ({ label: r, value: r })),
			},
			{
				name: "rate",
				type: "text",
				label: "Hourly rate (₦)",
				description: "Pay plus pension and allowances, per hour",
				defaultValue: person ? person.rate.toLocaleString("en-NG") : "",
				inputProps: { inputMode: "decimal" },
				validation: {
					required: "Hourly rate is required",
					validate: (v: string) => toNumber(v) > 0 || "Enter a rate above ₦0",
				},
			},
			{
				name: "hours",
				type: "text",
				label: "Hours per month",
				description: "Usually 160: 8 hours, 5 days a week",
				defaultValue: String(person?.hoursPerMonth ?? DEFAULT_HOURS),
				inputProps: { inputMode: "numeric" },
				validation: {
					required: "Hours are required",
					validate: (v: string) => toNumber(v) > 0 || "Enter the hours a month",
				},
			},
			{
				name: "notes",
				type: "textarea",
				label: "Notes (optional)",
				placeholder: "e.g. Also covers deliveries on Saturdays",
				defaultValue: person?.notes ?? "",
				rows: 3,
			},
		];
	}, [team, person, defaultTeam]);

	return (
		<Drawer
			title={person ? `Edit ${person.name}` : "Add staff member"}
			description="A new rate applies to new quotes from today. Quotes already sent keep the rate they were built with."
			onClose={onClose}
		>
			<MainForm<Values>
				methods={methods}
				fields={fields}
				rowPairs={[
					["phone", "email"],
					["rate", "hours"],
				]}
				hideRequiredMarks
				onSubmit={(v) =>
					onSave({
						id: person?.id ?? crypto.randomUUID(),
						name: v.name.trim(),
						phone: v.phone.trim(),
						email: v.email.trim(),
						team: person?.team ?? v.team,
						role: v.role,
						rate: toNumber(v.rate),
						hoursPerMonth: toNumber(v.hours),
						notes: v.notes?.trim() ?? "",
					})
				}
				renderFooter={({ canSubmit }) => (
					<div className="flex flex-wrap items-center gap-3">
						{onRemove && (
							<Button variant="danger" onClick={onRemove}>
								Remove from staff
							</Button>
						)}
						<span className="flex-1" />
						<Button onClick={onClose}>Cancel</Button>
						<Button type="submit" variant="primary" disabled={!canSubmit}>
							{person ? "Save changes" : "Add staff member"}
						</Button>
					</div>
				)}
			/>
		</Drawer>
	);
}
