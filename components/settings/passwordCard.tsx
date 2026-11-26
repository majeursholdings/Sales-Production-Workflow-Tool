"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/common/buttons";
import { Card } from "@/components/common/card";
import MainForm from "@/components/forms";
import PasswordChecklist from "@/components/forms/passwordChecklist";
import type { FormFieldConfig } from "@/components/forms/types";
import { passwordProblem } from "@/lib/passwordRules";
import { changePassword } from "@/lib/securityActions";

type PasswordValues = {
	current: string;
	password: string;
	confirm: string;
};

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
		validation: {
			required: "New password is required",
			validate: (value: string, values: Record<string, unknown>) =>
				passwordProblem(value) ??
				(value !== values.current || "Choose a password you haven't used here"),
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

/**
 * Change password: closed by default, opens into the form. `mustChange` opens it
 * with a warning (after a lockout the person says wasn't them).
 */
export default function PasswordCard({ mustChange = false }: { mustChange?: boolean }) {
	const [opened, setOpen] = useState(false);
	const open = opened || mustChange;
	const [saving, setSaving] = useState(false);
	const [serverError, setServerError] = useState<string | null>(null);
	const methods = useForm<PasswordValues>({
		mode: "onTouched",
		defaultValues: { current: "", password: "", confirm: "" },
	});
	const newPassword = useWatch({ control: methods.control, name: "password" });

	const close = () => {
		setOpen(false);
		setServerError(null);
		methods.reset();
	};

	const onSubmit = async ({ current, password }: PasswordValues) => {
		setServerError(null);
		setSaving(true);
		// The server checks the current password, then signs out other devices
		const result = await changePassword({ current, password });
		if (!result.ok) {
			setSaving(false);
			setServerError(result.message);
			return;
		}
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
					{mustChange && (
						<div
							role="alert"
							className="rounded-md border border-danger-line bg-danger-subtle px-3.5 py-2.5 text-small text-danger-fg"
						>
							Someone else may know your password. Choose a new, stronger one now.
							Every other device will be signed out.
						</div>
					)}
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
							<div className="flex flex-col gap-4">
								<PasswordChecklist password={newPassword ?? ""} />
								<div className="flex flex-wrap gap-3">
									<Button
										type="submit"
										variant="primary"
										disabled={!canSubmit || saving}
									>
										{saving ? "Updating…" : "Update password"}
									</Button>
									{!mustChange && (
										<Button onClick={close} disabled={saving}>
											Cancel
										</Button>
									)}
								</div>
							</div>
						)}
					/>
				</>
			)}
		</Card>
	);
}
