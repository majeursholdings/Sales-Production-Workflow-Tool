"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/common/buttons";
import { Card } from "@/components/common/card";
import MainForm from "@/components/forms";
import type { FormFieldConfig } from "@/components/forms/types";
import { createClient } from "@/utils/supabase/client";

type PasswordValues = {
	current: string;
	password: string;
	confirm: string;
};

const MIN_PASSWORD_LENGTH = 12;

const fields: FormFieldConfig[] = [
	{
		name: "current",
		type: "password",
		label: "Current password",
		autoComplete: "current-password",
		validation: { required: "Enter your current password" },
	},
	{
		name: "password",
		type: "password",
		label: "New password",
		autoComplete: "new-password",
		description: `At least ${MIN_PASSWORD_LENGTH} characters.`,
		validation: {
			required: "New password is required",
			minLength: {
				value: MIN_PASSWORD_LENGTH,
				message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
			},
			validate: (value: string, values: Record<string, unknown>) =>
				value !== values.current || "Choose a password you haven't used here",
		},
	},
	{
		name: "confirm",
		type: "password",
		label: "Confirm new password",
		autoComplete: "new-password",
		validation: {
			required: "Please confirm your new password",
			validate: (value: string, values: Record<string, unknown>) =>
				value === values.password || "Passwords do not match",
		},
	},
];

/** Change password: closed by default, opens into the form. */
export default function PasswordCard({ email }: { email: string }) {
	const [open, setOpen] = useState(false);
	const [saving, setSaving] = useState(false);
	const [serverError, setServerError] = useState<string | null>(null);
	const methods = useForm<PasswordValues>({
		mode: "onTouched",
		defaultValues: { current: "", password: "", confirm: "" },
	});

	const close = () => {
		setOpen(false);
		setServerError(null);
		methods.reset();
	};

	const onSubmit = async ({ current, password }: PasswordValues) => {
		setServerError(null);
		setSaving(true);
		const supabase = createClient();

		// Supabase doesn't check the old password on update, so prove it first
		const { error: verifyError } = await supabase.auth.signInWithPassword({
			email,
			password: current,
		});
		if (verifyError) {
			setSaving(false);
			setServerError("Your current password isn't right.");
			return;
		}

		const { error } = await supabase.auth.updateUser({ password });
		if (error) {
			setSaving(false);
			setServerError(error.message);
			return;
		}

		await supabase.auth.signOut({ scope: "others" });
		setSaving(false);
		close();
		toast.success("Password updated. Other devices will need to sign in again.");
	};

	return (
		<Card className="gap-4" aria-labelledby="password-title">
			<div className="flex flex-wrap items-center gap-3">
				<h2 id="password-title" className="flex-1">
					Password
				</h2>
				{!open && (
					<Button size="sm" onClick={() => setOpen(true)}>
						Change password
					</Button>
				)}
			</div>

			{open && (
				<>
					{serverError && (
						<div
							role="alert"
							className="rounded-md border border-danger-line bg-danger-subtle px-3.5 py-2.5 text-small text-danger-fg"
						>
							{serverError}
						</div>
					)}
					<MainForm<PasswordValues>
						methods={methods}
						fields={fields}
						isLoading={saving}
						hideRequiredMarks
						onSubmit={onSubmit}
						renderFooter={({ canSubmit }) => (
							<div className="flex flex-wrap gap-3">
								<Button
									type="submit"
									variant="primary"
									disabled={!canSubmit || saving}
								>
									{saving ? "Updating…" : "Update password"}
								</Button>
								<Button onClick={close} disabled={saving}>
									Cancel
								</Button>
							</div>
						)}
					/>
				</>
			)}
		</Card>
	);
}
