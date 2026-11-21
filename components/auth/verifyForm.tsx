"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/common/buttons";
import OtpInput from "@/components/forms/otpInput";
import { Input } from "@/components/forms/input";
import { sendVerificationCode, signOut, verifyCode, type VerifyMethod } from "@/lib/auth";
import { AuthAlert, AuthHeading, AuthNote, TextButton } from "./authParts";

const OTP_LENGTH = 6;

const methods: Record<VerifyMethod, { title: string; text: string; other: string }> = {
	app: {
		title: "Enter the code from your app",
		text: "Open your authenticator app and type the 6-digit code shown for Majeurs.",
		other: "Use the code from your authenticator app",
	},
	email: {
		title: "Check your email",
		text: "We sent a 6-digit code to your work email. It expires in 10 minutes.",
		other: "Email me a code instead",
	},
	backup: {
		title: "Use a backup code",
		text: "Enter one of the 10 codes you saved when you set up two-step verification. Each works once.",
		other: "Use a backup code",
	},
};

export default function VerifyForm() {
	const router = useRouter();
	const [method, setMethod] = useState<VerifyMethod>("app");
	const [code, setCode] = useState("");
	const [trustDevice, setTrustDevice] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);
	const [resent, setResent] = useState(false);

	const isBackup = method === "backup";
	const ready = isBackup ? code.trim().length > 0 : code.length === OTP_LENGTH;
	const copy = methods[method];

	const switchMethod = async (next: VerifyMethod) => {
		setMethod(next);
		setCode("");
		setError(null);
		setResent(false);
		if (next === "email") {
			const result = await sendVerificationCode("email");
			if (!result.ok) setError(result.message);
		}
	};

	const resend = async () => {
		const result = await sendVerificationCode("email");
		if (result.ok) {
			setResent(true);
			setError(null);
		} else setError(result.message);
	};

	const submit = async (e: FormEvent) => {
		e.preventDefault();
		if (!ready || pending) return;
		setError(null);
		setPending(true);
		const result = await verifyCode({ method, code: code.trim(), trustDevice });
		if (!result.ok) {
			setError(result.message);
			setPending(false);
			return;
		}
		router.push("/");
		router.refresh();
	};

	const switchAccount = async () => {
		await signOut();
		router.push("/login");
		router.refresh();
	};

	return (
		<>
			<TextButton onClick={switchAccount} className="self-start text-small text-fg-secondary">
				← Use a different account
			</TextButton>
			<AuthHeading title={copy.title}>{copy.text}</AuthHeading>
			{error && <AuthAlert>{error}</AuthAlert>}
			<form onSubmit={submit} noValidate className="flex flex-col gap-5">
				{isBackup ? (
					<Input
						label="Backup code"
						value={code}
						onChange={(e) => setCode(e.target.value)}
						autoComplete="one-time-code"
						autoFocus
						error={error ? "Check the code and try again." : undefined}
					/>
				) : (
					<div className="flex flex-col gap-2">
						<span className="text-body font-bold">{OTP_LENGTH}-digit code</span>
						<OtpInput
							// a fresh set of boxes (and focus) when the method changes
							key={method}
							length={OTP_LENGTH}
							value={code}
							onChange={setCode}
							error={!!error}
							disabled={pending}
							autoFocus
						/>
					</div>
				)}
				<label className="flex items-center gap-2 text-body">
					<input
						type="checkbox"
						checked={trustDevice}
						onChange={(e) => setTrustDevice(e.target.checked)}
						className="size-4 accent-accent"
					/>
					Don&apos;t ask again on this computer for 30 days
				</label>
				<Button
					type="submit"
					variant="primary"
					disabled={!ready || pending}
					className="w-full"
				>
					{pending ? (
						<>
							<Loader2 aria-hidden="true" className="animate-spin" />
							Verifying…
						</>
					) : (
						"Verify and sign in"
					)}
				</Button>
			</form>
			{method === "email" && (
				<AuthNote>
					Didn&apos;t get it? Check spam, or{" "}
					<TextButton onClick={resend}>send a new code</TextButton>.
					{resent && <span role="status"> New code sent.</span>}
				</AuthNote>
			)}
			<div className="flex flex-col gap-2 text-body">
				<span className="text-small text-fg-tertiary">Other ways to sign in</span>
				{(Object.keys(methods) as VerifyMethod[])
					.filter((key) => key !== method)
					.map((key) => (
						<TextButton key={key} onClick={() => switchMethod(key)}>
							{methods[key].other}
						</TextButton>
					))}
			</div>
			<AuthNote className="text-center">
				Lost your phone and backup codes? Ask your MD or GM to reset two-step verification
				in Team &amp; access.
			</AuthNote>
		</>
	);
}
