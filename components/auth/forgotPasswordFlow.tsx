"use client";

import { useState } from "react";
import { Check, Mail, Minus } from "lucide-react";
import { LinkButton } from "@/components/common/buttons";
import MainForm from "@/components/forms";
import { validators } from "@/components/forms/form.validators";
import type { FormFieldConfig } from "@/components/forms/types";
import { requestPasswordReset, resetPassword } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { AuthAlert, AuthBadge, AuthHeading, AuthNote, BackLink, TextButton } from "./authParts";

const MIN_PASSWORD_LENGTH = 12;

type RequestValues = { email: string };
type ResetValues = { password: string; confirm: string };

const requestFields: FormFieldConfig[] = [
	{
		name: "email",
		type: "email",
		label: "Work email",
		placeholder: "name@majeursholdings.com",
		autoComplete: "username",
		validation: validators.email(),
	},
];

const resetFields: FormFieldConfig[] = [
	{
		name: "password",
		type: "password",
		label: "New password",
		placeholder: "Enter a new password",
		autoComplete: "new-password",
		validation: {
			required: "Password is required",
			minLength: {
				value: MIN_PASSWORD_LENGTH,
				message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
			},
		},
	},
	{
		name: "confirm",
		type: "password",
		label: "Confirm new password",
		placeholder: "Enter it again",
		autoComplete: "new-password",
		validation: {
			required: "Please confirm your password",
			validate: (value: string, values: Record<string, unknown>) =>
				value === values.password || "Passwords do not match",
		},
	},
];

function Requirement({ met, children }: { met: boolean; children: string }) {
	return (
		<li
			className={cn(
				"flex items-center gap-2 text-small",
				met ? "text-success-fg" : "text-fg-tertiary",
			)}
		>
			{met ? (
				<Check aria-hidden="true" className="size-4" />
			) : (
				<Minus aria-hidden="true" className="size-4" />
			)}
			{children}
			<span className="sr-only">{met ? " (met)" : " (not met yet)"}</span>
		</li>
	);
}

export default function ForgotPasswordFlow({ token }: { token?: string }) {
	const [sentTo, setSentTo] = useState<string | null>(null);
	const [resent, setResent] = useState(false);
	const [updated, setUpdated] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	const sendLink = async ({ email }: RequestValues) => {
		setError(null);
		setPending(true);
		const result = await requestPasswordReset(email);
		setPending(false);
		if (!result.ok) return setError(result.message);
		setSentTo(email);
	};

	const resend = async () => {
		if (!sentTo) return;
		const result = await requestPasswordReset(sentTo);
		if (result.ok) setResent(true);
		else setError(result.message);
	};

	const saveNewPassword = async ({ password }: ResetValues) => {
		if (!token) return;
		setError(null);
		setPending(true);
		const result = await resetPassword({ token, password });
		setPending(false);
		if (!result.ok) return setError(result.message);
		setUpdated(true);
	};

	// 4. Done
	if (updated) {
		return (
			<>
				<AuthBadge tone="success">
					<Check />
				</AuthBadge>
				<AuthHeading title="Password updated">
					Sign in with your new password. Any lock on your account has been cleared.
				</AuthHeading>
				<LinkButton href="/login" variant="primary" className="w-full">
					Go to sign in
				</LinkButton>
			</>
		);
	}

	// 3. Set a new password (arrived from the emailed link)
	if (token) {
		return (
			<>
				<AuthHeading title="Set a new password">
					Choose a password you don&apos;t use anywhere else.
				</AuthHeading>
				{error && <AuthAlert>{error}</AuthAlert>}
				<MainForm<ResetValues>
					fields={resetFields}
					onSubmit={saveNewPassword}
					submitLabel="Save new password"
					isLoading={pending}
					hideRequiredMarks
					footerSlot={(values) => (
						<ul aria-label="Password requirements" className="flex flex-col gap-1">
							<Requirement
								met={(values.password?.length ?? 0) >= MIN_PASSWORD_LENGTH}
							>
								{`At least ${MIN_PASSWORD_LENGTH} characters`}
							</Requirement>
						</ul>
					)}
				/>
				<AuthNote>You&apos;ll be signed out on other devices.</AuthNote>
			</>
		);
	}

	// 2. Check your email
	if (sentTo) {
		return (
			<>
				<AuthBadge>
					<Mail />
				</AuthBadge>
				<AuthHeading title="Check your email">
					<span role="status">
						If {sentTo} has an account, a reset link is on its way. It works once and
						expires in 30 minutes.
					</span>
				</AuthHeading>
				{error && <AuthAlert>{error}</AuthAlert>}
				<AuthNote>
					Nothing after 5 minutes? Check spam, or{" "}
					<TextButton onClick={resend}>send it again</TextButton>.
					{resent && <span role="status"> Sent again.</span>}
				</AuthNote>
				<BackLink href="/login">Back to sign in</BackLink>
			</>
		);
	}

	// 1. Ask for the link
	return (
		<>
			<BackLink href="/login">Back to sign in</BackLink>
			<AuthHeading title="Reset your password">
				Enter your work email and we&apos;ll send you a link to set a new password.
			</AuthHeading>
			{error && <AuthAlert>{error}</AuthAlert>}
			<MainForm<RequestValues>
				fields={requestFields}
				onSubmit={sendLink}
				submitLabel="Send reset link"
				isLoading={pending}
				hideRequiredMarks
			/>
			<AuthNote className="text-center">
				No access to that mailbox? Ask your MD or GM to reset you from Team &amp; access.
			</AuthNote>
		</>
	);
}
