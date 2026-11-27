"use client";

import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Button } from "@/components/common/buttons";
import { Drawer } from "@/components/common/drawer";
import MainForm from "@/components/forms";
import { validators } from "@/components/forms/form.validators";
import { nameFieldConfigs, nameRow } from "@/components/forms/nameFields";
import type { FormFieldConfig } from "@/components/forms/types";
import { APP_ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS, type AppRole } from "@/lib/roles";
import type { TeamMember } from "@/lib/team";
import { updateTeamMemberAction } from "@/app/(dashboard)/team/actions";

type Values = {
	title: string;
	firstName: string;
	surname: string;
	email: string;
	phone: string;
	role: AppRole;
};

/** Edit a person's name, phone and role. (New people are added with an invite: addPersonCard.) */
export default function TeamDrawer({
	member,
	onSaved,
	onClose,
}: {
	member: TeamMember;
	onSaved: (saved: TeamMember) => void;
	onClose: () => void;
}) {
	const [serverError, setServerError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	const methods = useForm<Values>({
		mode: "onTouched",
		defaultValues: {
			title: member?.title ?? "",
			firstName: member?.firstName ?? "",
			surname: member?.surname ?? "",
			email: member?.email ?? "",
			phone: member?.phone ?? "",
			role: member?.role ?? "sales",
		},
	});

	const selectedRole = useWatch({ control: methods.control, name: "role" }) ?? "sales";

	const fields = useMemo<FormFieldConfig[]>(() => {
		const base: FormFieldConfig[] = [
			...nameFieldConfigs({
				defaults: {
					title: member?.title,
					firstName: member?.firstName,
					surname: member?.surname,
				},
			}),
			{
				name: "email",
				type: "email",
				label: "Work email",
				placeholder: "name@majeursholdings.com",
				disabled: Boolean(member),
				defaultValue: member?.email ?? "",
				description: member
					? "Email addresses are managed through authentication."
					: undefined,
				validation: validators.email(),
			},
			{
				name: "phone",
				type: "tel",
				label: "Phone number (optional)",
				placeholder: "+234 803 000 0000",
				defaultValue: member?.phone ?? "",
			},
			{
				name: "role",
				type: "select",
				label: "Role",
				defaultValue: member?.role ?? "sales",
				description: ROLE_DESCRIPTIONS[selectedRole],
				options: APP_ROLES.map((role) => ({
					label: ROLE_LABELS[role],
					value: role,
				})),
			},
		];

		return base;
	}, [member, selectedRole]);

	const handleSubmit = async (values: Values) => {
		setServerError(null);
		setSubmitting(true);

		const result = await updateTeamMemberAction({
			userId: member.id,
			title: values.title ?? "",
			firstName: values.firstName,
			surname: values.surname,
			phone: values.phone,
			role: values.role,
		});

		setSubmitting(false);

		if (!result.ok) {
			setServerError(result.message);
			return;
		}

		onSaved(result.data);
	};

	return (
		<Drawer
			title={member ? `Edit ${member.fullName}` : "Add person"}
			description={
				member
					? "Changing a role updates what pages and actions they can access."
					: "Create a work account and assign their role. Every change is recorded in the audit log."
			}
			onClose={onClose}
		>
			{serverError && (
				<div
					role="alert"
					className="mb-4 rounded-md border border-danger-line bg-danger-subtle px-3.5 py-2.5 text-small text-danger-fg"
				>
					{serverError}
				</div>
			)}

			<MainForm<Values>
				methods={methods}
				fields={fields}
				rowPairs={[nameRow()]}
				hideRequiredMarks
				isLoading={submitting}
				onSubmit={handleSubmit}
				renderFooter={({ canSubmit }) => (
					<div className="flex flex-wrap items-center justify-end gap-3">
						<Button onClick={onClose} disabled={submitting}>
							Cancel
						</Button>
						<Button type="submit" variant="primary" disabled={!canSubmit || submitting}>
							{submitting ? "Saving…" : "Save changes"}
						</Button>
					</div>
				)}
			/>
		</Drawer>
	);
}
