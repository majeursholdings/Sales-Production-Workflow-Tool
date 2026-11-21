"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Button } from "@/components/common/buttons";
import { Card } from "@/components/common/card";
import MainForm from "@/components/forms";
import { validators } from "@/components/forms/form.validators";
import type { FormFieldConfig } from "@/components/forms/types";
import { APP_ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS, type AppRole } from "@/lib/roles";
import type { TeamMember } from "@/lib/team";
import { createTeamMemberAction } from "@/app/(dashboard)/team/actions";

type Values = {
	fullName: string;
	email: string;
	role: AppRole;
};

/** The "Add a person" panel that opens under the page title. They get an email invite to set their own password. */
export default function AddPersonCard({
	onAdded,
	onCancel,
}: {
	onAdded: (member: TeamMember) => void;
	onCancel: () => void;
}) {
	const [serverError, setServerError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	const methods = useForm<Values>({
		mode: "onTouched",
		defaultValues: { fullName: "", email: "", role: "customer_care" },
	});

	const role = useWatch({ control: methods.control, name: "role" }) ?? "customer_care";

	const fields: FormFieldConfig[] = [
		{
			name: "fullName",
			type: "text",
			label: "Full name",
			placeholder: "As it should appear on quotes",
			validation: validators.required("Full name"),
		},
		{
			name: "email",
			type: "email",
			label: "Work email",
			placeholder: "name@majeursholdings.com",
			validation: validators.email(),
		},
		{
			name: "role",
			type: "select",
			label: "Role",
			defaultValue: "customer_care",
			description: ROLE_DESCRIPTIONS[role] ?? undefined,
			options: APP_ROLES.map((value) => ({ label: ROLE_LABELS[value], value })),
		},
	];

	const handleSubmit = async (values: Values) => {
		setServerError(null);
		setSubmitting(true);
		const result = await createTeamMemberAction({ ...values, mode: "invite" });
		setSubmitting(false);
		if (!result.ok) {
			setServerError(result.message);
			return;
		}
		onAdded(result.data);
	};

	return (
		<Card className="gap-4" aria-labelledby="add-person-title">
			<h2 id="add-person-title">Add a person</h2>

			{serverError && (
				<div
					role="alert"
					className="rounded-md border border-danger-line bg-danger-subtle px-3.5 py-2.5 text-small text-danger-fg"
				>
					{serverError}
				</div>
			)}

			<MainForm<Values>
				methods={methods}
				fields={fields}
				rowPairs={[["fullName", "email"]]}
				hideRequiredMarks
				isLoading={submitting}
				onSubmit={handleSubmit}
				footerSlot={
					<p className="text-small text-fg-tertiary">
						They get an email from your majeursholdings.com mailbox with a link to set
						their password. The link expires in 48 hours.
					</p>
				}
				renderFooter={({ canSubmit }) => (
					<div className="flex flex-wrap items-center gap-3">
						<Button type="submit" variant="primary" disabled={!canSubmit || submitting}>
							{submitting ? "Sending…" : "Send invite"}
						</Button>
						<Button onClick={onCancel} disabled={submitting}>
							Cancel
						</Button>
					</div>
				)}
			/>
		</Card>
	);
}
