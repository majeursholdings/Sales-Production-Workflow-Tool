"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/common/card";
import MainForm from "@/components/forms";
import { validators } from "@/components/forms/form.validators";
import type { FormFieldConfig } from "@/components/forms/types";
import { createClient } from "@/utils/supabase/client";

type ProfileValues = {
	fullName: string;
	phone: string;
	email: string;
	role: string;
	emailSignature: string;
};

const initialsOf = (name: string) =>
	name
		.split(/\s+/)
		.map((word) => word[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();

export default function ProfileForm({
	userId,
	initialName,
	email,
	initialPhone,
	roleLabel,
	initialSignature,
}: {
	userId: string;
	initialName: string;
	email: string;
	initialPhone: string;
	roleLabel: string;
	initialSignature: string;
}) {
	const router = useRouter();
	const [saving, setSaving] = useState(false);

	const fields: FormFieldConfig[] = [
		{
			name: "fullName",
			type: "text",
			label: "Full name",
			defaultValue: initialName,
			description: "Shown on quotes, invoices and notes you create.",
			validation: validators.required("Full name"),
		},
		{
			name: "phone",
			type: "tel",
			label: "Phone",
			placeholder: "+234 803 000 0000",
			defaultValue: initialPhone,
			description: "Clients see this on quotes you prepare.",
		},
		{
			name: "email",
			type: "email",
			label: "Work email",
			defaultValue: email,
			disabled: true,
			description: "Only the MD or GM can change this.",
		},
		{
			name: "role",
			type: "text",
			label: "Role",
			defaultValue: roleLabel,
			disabled: true,
			description: "Set in Team & access.",
		},
		{
			name: "emailSignature",
			type: "textarea",
			label: "Email signature",
			rows: 4,
			defaultValue: initialSignature,
			description: "Added to quotes, invoices and follow-ups you send.",
		},
	];

	const onSubmit = async (values: ProfileValues) => {
		setSaving(true);
		const supabase = createClient();
		const { error } = await supabase
			.from("profiles")
			.update({
				full_name: values.fullName.trim(),
				phone: values.phone.trim(),
				email_signature: values.emailSignature.trim(),
			})
			.eq("id", userId);

		setSaving(false);

		if (error) {
			toast.error(error.message);
			return;
		}

		toast.success("Your profile is saved.");
		router.refresh();
	};

	return (
		<Card className="gap-5" aria-labelledby="profile-title">
			<h2 id="profile-title">Profile</h2>

			<div className="flex items-center gap-4">
				<span
					aria-hidden="true"
					className="grid size-14 shrink-0 place-items-center rounded-full bg-accent-subtle text-lg font-bold text-accent-fg"
				>
					{initialsOf(initialName)}
				</span>
				<div className="flex min-w-0 flex-col">
					<strong className="text-body text-fg">{initialName}</strong>
					<span className="text-small text-fg-tertiary">
						{roleLabel} · {email}
					</span>
				</div>
			</div>

			<MainForm<ProfileValues>
				fields={fields}
				rowPairs={[
					["fullName", "phone"],
					["email", "role"],
				]}
				onSubmit={onSubmit}
				submitLabel="Save profile"
				isLoading={saving}
				hideRequiredMarks
				requireValidToSubmit={false}
			/>
		</Card>
	);
}
