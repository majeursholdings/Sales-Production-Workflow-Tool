"use client";

import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Button } from "@/components/common/buttons";
import { Drawer } from "@/components/common/drawer";
import MainForm from "@/components/forms";
import { validators } from "@/components/forms/form.validators";
import type { FormFieldConfig } from "@/components/forms/types";
import { APP_ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS, type AppRole } from "@/lib/roles";
import type { TeamMember } from "@/lib/team";
import { createTeamMemberAction, updateTeamMemberAction } from "@/app/(dashboard)/team/actions";

type Values = {
	fullName: string;
	email: string;
	phone: string;
	role: AppRole;
	mode: "password" | "invite";
	password: string;
};

export default function TeamDrawer({
	member,
	onSaved,
	onClose,
}: {
	member?: TeamMember;
	onSaved: (saved: TeamMember, isNew: boolean) => void;
	onClose: () => void;
}) {
	const [serverError, setServerError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	const methods = useForm<Values>({
		mode: "onTouched",
		defaultValues: {
			fullName: member?.fullName ?? "",
			email: member?.email ?? "",
			phone: member?.phone ?? "",
			role: member?.role ?? "sales",
			mode: "password",
			password: "",
		},
	});

	const selectedRole = useWatch({ control: methods.control, name: "role" }) ?? "sales";
	const selectedMode = useWatch({ control: methods.control, name: "mode" }) ?? "password";

	const fields = useMemo<FormFieldConfig[]>(() => {
		const base: FormFieldConfig[] = [
			{
				name: "fullName",
				type: "text",
				label: "Full name",
				placeholder: "Full name",
				defaultValue: member?.fullName ?? "",
				validation: validators.required("Full name"),
			},
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

		if (!member) {
			base.push({
				name: "mode",
				type: "radio",
				label: "How should they set their password?",
				defaultValue: "password",
				options: [
					{
						label: "Set an initial password now (ready to sign in immediately)",
						value: "password",
					},
					{
						label: "Send an email invite link (requires SMTP configured in Supabase)",
						value: "invite",
					},
				],
			});

			if (selectedMode === "password") {
				base.push({
					name: "password",
					type: "password",
					label: "Initial password",
					placeholder: "At least 12 characters",
					description:
						"Share securely; they can change it in Settings -> Security & sign-in.",
					autoComplete: "new-password",
					validation: {
						required: "Initial password is required",
						minLength: {
							value: 12,
							message: "Password must be at least 12 characters",
						},
					},
				});
			}
		}

		return base;
	}, [member, selectedRole, selectedMode]);

	const handleSubmit = async (values: Values) => {
		setServerError(null);
		setSubmitting(true);

		const result = member
			? await updateTeamMemberAction({
					userId: member.id,
					fullName: values.fullName,
					phone: values.phone,
					role: values.role,
				})
			: await createTeamMemberAction({
					fullName: values.fullName,
					email: values.email,
					phone: values.phone,
					role: values.role,
					mode: values.mode,
					password: values.password,
				});

		setSubmitting(false);

		if (!result.ok) {
			setServerError(result.message);
			return;
		}

		onSaved(result.data, !member);
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
				hideRequiredMarks
				isLoading={submitting}
				onSubmit={handleSubmit}
				renderFooter={({ canSubmit }) => (
					<div className="flex flex-wrap items-center justify-end gap-3">
						<Button onClick={onClose} disabled={submitting}>
							Cancel
						</Button>
						<Button type="submit" variant="primary" disabled={!canSubmit || submitting}>
							{submitting
								? "Saving…"
								: member
									? "Save changes"
									: selectedMode === "invite"
										? "Send invite"
										: "Create account"}
						</Button>
					</div>
				)}
			/>
		</Drawer>
	);
}
