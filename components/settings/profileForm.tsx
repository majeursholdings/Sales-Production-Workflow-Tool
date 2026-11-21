"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/common/badge";
import { Card } from "@/components/common/card";
import MainForm from "@/components/forms";
import { validators } from "@/components/forms/form.validators";
import type { FormFieldConfig } from "@/components/forms/types";
import { createClient } from "@/utils/supabase/client";

type ProfileValues = {
	fullName: string;
	phone: string;
};

export default function ProfileForm({
	userId,
	initialName,
	email,
	initialPhone,
	roleLabel,
}: {
	userId: string;
	initialName: string;
	email: string;
	initialPhone: string;
	roleLabel: string;
}) {
	const router = useRouter();
	const [saving, setSaving] = useState(false);

	const fields: FormFieldConfig[] = [
		{
			name: "fullName",
			type: "text",
			label: "Full name",
			defaultValue: initialName,
			validation: validators.required("Full name"),
		},
		{
			name: "phone",
			type: "tel",
			label: "Phone number",
			placeholder: "+234 803 000 0000",
			defaultValue: initialPhone,
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
			})
			.eq("id", userId);

		setSaving(false);

		if (error) {
			toast.error(error.message);
			return;
		}

		toast.success("Profile updated.");
		router.refresh();
	};

	return (
		<Card className="gap-5">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="flex flex-col gap-1">
					<h2>Profile</h2>
					<p className="text-small text-fg-secondary">{email}</p>
				</div>
				<Badge variant="info">{roleLabel}</Badge>
			</div>

			<MainForm<ProfileValues>
				fields={fields}
				onSubmit={onSubmit}
				submitLabel="Save profile"
				isLoading={saving}
				hideRequiredMarks
			/>

			<p className="text-small text-fg-tertiary">
				Your email and role are managed by your MD or GM in Team &amp; access.
			</p>
		</Card>
	);
}
