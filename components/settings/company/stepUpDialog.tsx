"use client";

import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/common/buttons";
import { Dialog } from "@/components/common/modal";
import MainForm from "@/components/forms";
import type { FormFieldConfig } from "@/components/forms/types";
import type { ActionResult } from "@/lib/actionResult";
import { sendEmailCode } from "@/lib/emailTwoStepActions";

type Proof = { password: string; code: string; method: "app" | "email" };

/**
 * Asks for the password and a fresh two-step code before a sensitive change.
 * `onConfirm` sends them with the change; the dialog stays open on an error.
 */
export default function StepUpDialog({
	title,
	description,
	hasApp,
	hasEmail,
	confirmLabel,
	onConfirm,
	onClose,
}: {
	title: string;
	description: string;
	hasApp: boolean;
	hasEmail: boolean;
	confirmLabel: string;
	onConfirm: (proof: Proof) => Promise<ActionResult>;
	onClose: () => void;
}) {
	const [error, setError] = useState<string | null>(null);
	const [codeSent, setCodeSent] = useState(false);
	const [sending, startSending] = useTransition();
	const form = useForm<Proof>({
		mode: "onTouched",
		defaultValues: { password: "", code: "", method: hasApp ? "app" : "email" },
	});
	const method = useWatch({ control: form.control, name: "method" });

	if (!hasApp && !hasEmail) {
		return (
			<Dialog title={title} onClose={onClose}>
				<p className="text-body">
					This change needs your password and a two-step code. Turn on an authenticator
					app or email codes in Settings › Security first.
				</p>
				<div className="flex justify-end">
					<Button onClick={onClose}>Close</Button>
				</div>
			</Dialog>
		);
	}

	const fields: FormFieldConfig[] = [
		{
			name: "password",
			type: "password",
			label: "Your password",
			autoComplete: "current-password",
			autoFocus: true,
			validation: { required: "Enter your password." },
		},
		...(hasApp && hasEmail
			? [
					{
						name: "method",
						type: "radio",
						label: "Where's your code from?",
						options: [
							{ value: "app", label: "Authenticator app" },
							{ value: "email", label: "Email" },
						],
					} satisfies FormFieldConfig,
				]
			: []),
		{
			name: "code",
			type: "text",
			label: method === "app" ? "6-digit code from your app" : "6-digit code from your email",
			inputMode: "numeric",
			autoComplete: "one-time-code",
			maxLength: 6,
			validation: {
				required: "Enter the 6-digit code.",
				pattern: { value: /^\d{6}$/, message: "Enter the 6-digit code." },
			},
		},
	];

	return (
		<Dialog title={title} description={description} onClose={onClose}>
			{error && (
				<p
					role="alert"
					className="rounded-md border border-danger-line bg-danger-subtle p-3 text-body text-danger-fg"
				>
					{error}
				</p>
			)}
			<MainForm<Proof>
				methods={form}
				fields={fields}
				hideRequiredMarks
				footerSlot={
					method === "email" ? (
						<Button
							size="sm"
							className="self-start"
							disabled={sending}
							onClick={() =>
								startSending(async () => {
									const res = await sendEmailCode();
									if (res.ok) {
										setCodeSent(true);
										toast.success("Code sent. Check your email.");
									} else setError(res.message);
								})
							}
						>
							{sending
								? "Sending…"
								: codeSent
									? "Send a new code"
									: "Email me a code"}
						</Button>
					) : null
				}
				onSubmit={async (values) => {
					setError(null);
					const res = await onConfirm(values);
					if (!res.ok) {
						setError(res.message);
						form.setValue("code", "");
					}
				}}
				renderFooter={({ canSubmit }) => (
					<div className="flex flex-wrap justify-end gap-3">
						<Button onClick={onClose}>Cancel</Button>
						<Button
							type="submit"
							variant="primary"
							disabled={!canSubmit || form.formState.isSubmitting}
						>
							{form.formState.isSubmitting ? "Checking…" : confirmLabel}
						</Button>
					</div>
				)}
			/>
		</Dialog>
	);
}
