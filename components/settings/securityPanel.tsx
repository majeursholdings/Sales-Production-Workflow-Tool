"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/common/badge";
import { Button } from "@/components/common/buttons";
import { Card } from "@/components/common/card";
import MainForm from "@/components/forms";
import OtpInput from "@/components/forms/otpInput";
import type { FormFieldConfig } from "@/components/forms/types";
import { createClient } from "@/utils/supabase/client";

type PasswordValues = {
	password: string;
	confirm: string;
};

type EnrolledFactor = {
	id: string;
	friendlyName: string;
};

type PendingEnrollment = {
	factorId: string;
	qrCode: string;
	secret: string;
};

const MIN_PASSWORD_LENGTH = 12;

const passwordFields: FormFieldConfig[] = [
	{
		name: "password",
		type: "password",
		label: "New password",
		placeholder: "At least 12 characters",
		autoComplete: "new-password",
		validation: {
			required: "New password is required",
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

export default function SecurityPanel() {
	const [savingPassword, setSavingPassword] = useState(false);
	const [loadingMfa, setLoadingMfa] = useState(true);
	const [factors, setFactors] = useState<EnrolledFactor[]>([]);
	const [pending, setPending] = useState<PendingEnrollment | null>(null);
	const [verifyCode, setVerifyCode] = useState("");
	const [mfaBusy, setMfaBusy] = useState(false);

	const loadFactors = async () => {
		setLoadingMfa(true);
		const supabase = createClient();
		const { data, error } = await supabase.auth.mfa.listFactors();
		if (!error && data) {
			setFactors(
				data.totp
					.filter((f) => f.status === "verified")
					.map((f) => ({
						id: f.id,
						friendlyName: f.friendly_name || "Authenticator app",
					})),
			);
		}
		setLoadingMfa(false);
	};

	useEffect(() => {
		let cancelled = false;
		const run = async () => {
			const supabase = createClient();
			const { data, error } = await supabase.auth.mfa.listFactors();
			if (cancelled) return;
			if (!error && data) {
				setFactors(
					data.totp
						.filter((f) => f.status === "verified")
						.map((f) => ({
							id: f.id,
							friendlyName: f.friendly_name || "Authenticator app",
						})),
				);
			}
			setLoadingMfa(false);
		};
		void run();
		return () => {
			cancelled = true;
		};
	}, []);

	const handlePasswordChange = async ({ password }: PasswordValues) => {
		setSavingPassword(true);
		const supabase = createClient();
		const { error } = await supabase.auth.updateUser({ password });
		if (error) {
			toast.error(error.message);
			setSavingPassword(false);
			return;
		}
		await supabase.auth.signOut({ scope: "others" });
		setSavingPassword(false);
		toast.success("Password updated. Other devices have been signed out.");
	};

	const startMfaEnroll = async () => {
		setMfaBusy(true);
		const supabase = createClient();
		const { data, error } = await supabase.auth.mfa.enroll({
			factorType: "totp",
			friendlyName: "Authenticator app",
		});
		setMfaBusy(false);

		if (error || !data) {
			toast.error(error?.message ?? "Could not start two-step verification setup.");
			return;
		}

		setPending({
			factorId: data.id,
			qrCode: data.totp.qr_code,
			secret: data.totp.secret,
		});
		setVerifyCode("");
	};

	const confirmMfaEnroll = async () => {
		if (!pending || verifyCode.length !== 6) return;
		setMfaBusy(true);
		const supabase = createClient();
		const { error } = await supabase.auth.mfa.challengeAndVerify({
			factorId: pending.factorId,
			code: verifyCode,
		});
		setMfaBusy(false);

		if (error) {
			toast.error("That code didn't match. Check your authenticator app and try again.");
			return;
		}

		setPending(null);
		setVerifyCode("");
		toast.success("Two-step verification enabled. You'll be asked for a code at sign-in.");
		await loadFactors();
	};

	const removeFactor = async (factorId: string) => {
		setMfaBusy(true);
		const supabase = createClient();
		const { error } = await supabase.auth.mfa.unenroll({ factorId });
		setMfaBusy(false);

		if (error) {
			toast.error(error.message);
			return;
		}

		toast.success("Two-step verification removed.");
		await loadFactors();
	};

	return (
		<div className="flex flex-col gap-6">
			<Card className="gap-4">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="flex flex-col gap-1">
						<h2>Two-step verification</h2>
						<p className="text-small text-fg-secondary">
							Protect your account with a 6-digit code from an authenticator app on
							sign-in.
						</p>
					</div>
					<Badge variant={factors.length > 0 ? "success" : "neutral"}>
						{factors.length > 0 ? "Enabled" : "Not enabled"}
					</Badge>
				</div>

				{loadingMfa ? (
					<p className="text-small text-fg-tertiary">Checking verification status…</p>
				) : factors.length > 0 ? (
					<ul className="flex flex-col gap-2">
						{factors.map((factor) => (
							<li
								key={factor.id}
								className="flex items-center justify-between gap-3 rounded-md border border-line px-3.5 py-2.5"
							>
								<span className="flex items-center gap-2 text-body">
									<ShieldCheck
										className="size-4 text-success-fg"
										aria-hidden="true"
									/>
									{factor.friendlyName}
								</span>
								<Button
									size="sm"
									variant="danger"
									disabled={mfaBusy}
									onClick={() => removeFactor(factor.id)}
								>
									<Trash2 />
									Remove
								</Button>
							</li>
						))}
					</ul>
				) : pending ? (
					<div className="flex flex-col gap-4 rounded-md border border-line bg-subtle p-4">
						<p className="text-body text-fg-secondary">
							1. Scan this QR code with Google Authenticator, 1Password, or Authy:
						</p>
						{/* Supabase returns an inline SVG data URI for TOTP enrollment */}
						{/* eslint-disable-next-line @next/next/no-img-element */}
						<img
							src={pending.qrCode}
							alt="Authenticator app QR code"
							className="size-44 rounded-md border border-line bg-white p-2"
						/>
						<p className="text-small text-fg-tertiary">
							Or enter this setup key manually:{" "}
							<code className="rounded bg-surface px-1.5 py-0.5 font-mono text-fg">
								{pending.secret}
							</code>
						</p>
						<div className="flex flex-col gap-2">
							<span className="text-body font-bold">
								2. Enter the 6-digit code to confirm
							</span>
							<OtpInput
								length={6}
								value={verifyCode}
								onChange={setVerifyCode}
								disabled={mfaBusy}
							/>
						</div>
						<div className="flex flex-wrap gap-2">
							<Button
								variant="primary"
								disabled={verifyCode.length !== 6 || mfaBusy}
								onClick={confirmMfaEnroll}
							>
								{mfaBusy ? "Verifying…" : "Confirm and enable"}
							</Button>
							<Button disabled={mfaBusy} onClick={() => setPending(null)}>
								Cancel
							</Button>
						</div>
					</div>
				) : (
					<div>
						<Button variant="primary" disabled={mfaBusy} onClick={startMfaEnroll}>
							Set up authenticator app
						</Button>
					</div>
				)}
			</Card>

			<Card className="gap-4">
				<div className="flex flex-col gap-1">
					<h2>Change password</h2>
					<p className="text-small text-fg-secondary">
						Choose a password of at least {MIN_PASSWORD_LENGTH} characters. Other
						devices will be signed out.
					</p>
				</div>
				<MainForm<PasswordValues>
					fields={passwordFields}
					onSubmit={handlePasswordChange}
					submitLabel="Update password"
					isLoading={savingPassword}
					hideRequiredMarks
				/>
			</Card>
		</div>
	);
}
