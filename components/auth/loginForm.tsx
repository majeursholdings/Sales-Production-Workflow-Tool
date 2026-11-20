"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import MainForm from "@/components/forms";
import { validators } from "@/components/forms/form.validators";
import type { FormFieldConfig } from "@/components/forms/types";
import { signIn } from "@/lib/auth";
import { AuthAlert, AuthHeading, AuthNote } from "./authParts";

type LoginValues = { email: string; password: string; remember: boolean };

const fields: FormFieldConfig[] = [
	{
		name: "email",
		type: "email",
		label: "Work email",
		placeholder: "name@majeursholdings.com",
		autoComplete: "username",
		validation: validators.email(),
	},
	{
		name: "password",
		type: "password",
		label: "Password",
		placeholder: "Enter your password",
		autoComplete: "current-password",
		validation: validators.required("Password"),
	},
	{
		name: "remember",
		type: "checkbox",
		label: "Keep me signed in on this computer",
		defaultValue: false,
		trailingSlot: <Link href="/forgot-password">Forgot password?</Link>,
	},
];

export default function LoginForm() {
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	const onSubmit = async (values: LoginValues) => {
		setError(null);
		setPending(true);
		const result = await signIn(values);
		if (!result.ok) {
			setError(result.message);
			setPending(false);
			return;
		}
		// Staying in "pending" through the redirect stops a second submit.
		router.push("/verify");
	};

	return (
		<>
			<AuthHeading title="Sign in">
				Use the work email your MD or GM set up for you.
			</AuthHeading>
			{error && <AuthAlert>{error}</AuthAlert>}
			<MainForm<LoginValues>
				fields={fields}
				onSubmit={onSubmit}
				submitLabel="Sign in"
				isLoading={pending}
				hideRequiredMarks
			/>
			<AuthNote className="text-center">
				Trouble signing in? Ask your MD or GM to reset your access in Team &amp; access.
			</AuthNote>
		</>
	);
}
