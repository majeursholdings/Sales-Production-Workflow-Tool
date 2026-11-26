"use client";

import { useState } from "react";
import { Mail, ShieldCheck, Smartphone } from "lucide-react";
import { LinkButton } from "@/components/common/buttons";
import MainForm from "@/components/forms";
import PasswordChecklist from "@/components/forms/passwordChecklist";
import type { FormFieldConfig } from "@/components/forms/types";
import { finishAccountSetup } from "@/lib/auth";
import { passwordProblem } from "@/lib/passwordRules";
import { AuthAlert, AuthBadge, AuthHeading, AuthNote } from "./authParts";

type PasswordValues = { password: string; confirm: string };

const fields: FormFieldConfig[] = [
	{
		name: "password",
		type: "password",
		label: "Password",
		placeholder: "Choose a password",
		autoComplete: "new-password",
		validation: {
			required: "Password is required",
			validate: (value: string) => passwordProblem(value) ?? true,
		},
	},
	{
		name: "confirm",
		type: "password",
		label: "Confirm password",
		placeholder: "Enter it again",
		autoComplete: "new-password",
		validation: {
			required: "Please confirm your password",
			validate: (value: string, values: Record<string, unknown>) =>
				value === values.password || "Passwords do not match",
		},
	},
];

/**
 * Invite onboarding: 1. set a password (stronger rules), 2. two-step: email
 * codes are on by default; adding an authenticator app is optional.
 */
export default function WelcomeFlow({
	email,
	needsPassword,
}: {
	email: string;
	needsPassword: boolean;
}) {
	const [done, setDone] = useState(!needsPassword);
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	const savePassword = async ({ password }: PasswordValues) => {
		setError(null);
		setPending(true);
		const result = await finishAccountSetup({ password });
		setPending(false);
		if (!result.ok) return setError(result.message);
		setDone(true);
	};

	if (done) {
		return (
			<>
				<AuthBadge tone="success">
					<ShieldCheck />
				</AuthBadge>
				<AuthHeading title="Two-step verification is on">
					Each time you sign in, we&apos;ll email a 6-digit code to{" "}
					<strong>{email || "your work email"}</strong> after your password.
				</AuthHeading>
				<div className="flex flex-col gap-3 rounded-md border border-line p-4 text-body">
					<span className="flex items-center gap-2">
						<Mail aria-hidden="true" className="size-5 text-fg-secondary" />
						<strong>Email code</strong>
						<span className="text-fg-tertiary">· on</span>
					</span>
					<span className="flex items-center gap-2">
						<Smartphone aria-hidden="true" className="size-5 text-fg-secondary" />
						<strong>Authenticator app</strong>
						<span className="text-fg-tertiary">· optional, works without signal</span>
					</span>
				</div>
				<LinkButton href="/" variant="primary" className="w-full">
					Go to Majeurs
				</LinkButton>
				<LinkButton href="/settings/security" className="w-full">
					Add an authenticator app
				</LinkButton>
			</>
		);
	}

	return (
		<>
			<AuthHeading title="Welcome to Majeurs">
				Set a password for <strong>{email || "your account"}</strong>. Choose one you
				don&apos;t use anywhere else.
			</AuthHeading>
			{error && <AuthAlert>{error}</AuthAlert>}
			<MainForm<PasswordValues>
				fields={fields}
				onSubmit={savePassword}
				submitLabel="Set password"
				isLoading={pending}
				hideRequiredMarks
				footerSlot={(values) => <PasswordChecklist password={values.password ?? ""} />}
			/>
			<AuthNote>Next, we&apos;ll show you how sign-in codes work.</AuthNote>
		</>
	);
}
