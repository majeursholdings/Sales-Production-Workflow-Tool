"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/common/card";
import MainForm from "@/components/forms";
import { nameFieldConfigs, nameRow } from "@/components/forms/nameFields";
import type { FormFieldConfig } from "@/components/forms/types";
import { updateProfile } from "@/lib/profileActions";

type ProfileValues = {
	title: string;
	firstName: string;
	surname: string;
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
	initialName,
	initialTitle,
	initialFirstName,
	initialSurname,
	email,
	initialPhone,
	roleLabel,
	initialSignature,
}: {
	/** Written out, for the header. */
	initialName: string;
	initialTitle: string;
	initialFirstName: string;
	initialSurname: string;
	email: string;
	initialPhone: string;
	roleLabel: string;
	initialSignature: string;
}) {
	const router = useRouter();
	const [saving, setSaving] = useState(false);

	const fields: FormFieldConfig[] = [
		...nameFieldConfigs({
			defaults: {
				title: initialTitle,
				firstName: initialFirstName,
				surname: initialSurname,
			},
			description: "Shown on quotes, invoices and notes you create.",
		}),
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
		const result = await updateProfile({
			title: values.title ?? "",
			firstName: values.firstName,
			surname: values.surname,
			phone: values.phone,
			emailSignature: values.emailSignature,
		});

		setSaving(false);

		if (!result.ok) {
			toast.error(result.message);
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
				rowPairs={[nameRow(), ["phone", "email"]]}
				onSubmit={onSubmit}
				submitLabel="Save profile"
				isLoading={saving}
				hideRequiredMarks
				requireValidToSubmit={false}
			/>
		</Card>
	);
}
