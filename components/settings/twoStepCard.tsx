"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";
import { Mail, Smartphone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/common/badge";
import { Button } from "@/components/common/buttons";
import { Card } from "@/components/common/card";
import { ConfirmDialog } from "@/components/common/modal";
import OtpInput from "@/components/forms/otpInput";
import { IconButton } from "@/components/tables";
import { disableEmailTwoStep, enableEmailTwoStep, sendEmailCode } from "@/lib/emailTwoStepActions";
import {
	cancelTotpEnroll,
	confirmTotpEnroll,
	removeTotpFactor,
	startTotpEnroll,
} from "@/lib/securityActions";

export type EnrolledFactor = {
	id: string;
	friendlyName: string;
	/** ISO date the factor was added. */
	createdAt: string;
};

type PendingEnrollment = { factorId: string; qrCode: string; secret: string };
type Removing = { kind: "app"; factor: EnrolledFactor } | { kind: "email" };

/** Two-step verification with an authenticator app, a code by email, or both. */
export default function TwoStepCard({
	factors,
	email,
	emailOn,
}: {
	factors: EnrolledFactor[];
	/** Work email the codes go to. */
	email: string;
	/** Email codes are turned on. */
	emailOn: boolean;
}) {
	const router = useRouter();
	const [pending, setPending] = useState<PendingEnrollment | null>(null);
	const [emailSetup, setEmailSetup] = useState(false);
	const [code, setCode] = useState("");
	const [busy, setBusy] = useState(false);
	const [removing, setRemoving] = useState<Removing | null>(null);

	const appOn = factors.length > 0;
	const enabled = appOn || emailOn;
	const settingUp = !!pending || emailSetup;

	// ── Authenticator app ────────────────────────────────────────────────────
	const startEnroll = async () => {
		setBusy(true);
		const result = await startTotpEnroll();
		setBusy(false);

		if (!result.ok) {
			toast.error(result.message);
			return;
		}
		setPending(result.enrollment);
		setCode("");
	};

	// Drops the unverified factor so setting up again later starts clean
	const cancelEnroll = async () => {
		if (!pending) return;
		setBusy(true);
		await cancelTotpEnroll(pending.factorId);
		setBusy(false);
		setPending(null);
		setCode("");
	};

	const confirmEnroll = async () => {
		if (!pending || code.length !== 6) return;
		setBusy(true);
		const result = await confirmTotpEnroll(pending.factorId, code);
		setBusy(false);

		if (!result.ok) {
			toast.error(result.message);
			setCode("");
			return;
		}
		setPending(null);
		setCode("");
		toast.success("Authenticator app added. You'll be asked for a code when you sign in.");
		router.refresh();
	};

	// ── Email codes ──────────────────────────────────────────────────────────
	const startEmail = async () => {
		setBusy(true);
		const result = await sendEmailCode();
		setBusy(false);
		if (!result.ok) {
			toast.error(result.message);
			return;
		}
		setEmailSetup(true);
		setCode("");
	};

	const resendEmail = async () => {
		setBusy(true);
		const result = await sendEmailCode();
		setBusy(false);
		if (result.ok) toast.success(`New code sent to ${email}.`);
		else toast.error(result.message);
	};

	const confirmEmail = async () => {
		if (code.length !== 6) return;
		setBusy(true);
		const result = await enableEmailTwoStep(code);
		setBusy(false);
		if (!result.ok) {
			toast.error(result.message);
			setCode("");
			return;
		}
		setEmailSetup(false);
		setCode("");
		toast.success(
			appOn
				? "Email codes added as a backup to your authenticator app."
				: "Two-step verification is on. We'll email you a code when you sign in.",
		);
		router.refresh();
	};

	// ── Removing a method ────────────────────────────────────────────────────
	const remove = async () => {
		if (!removing) return;
		setBusy(true);
		let message: string | null = null;
		if (removing.kind === "app") {
			const result = await removeTotpFactor(removing.factor.id);
			message = result.ok ? null : result.message;
		} else {
			const result = await disableEmailTwoStep();
			message = result.ok ? null : result.message;
		}
		setBusy(false);

		if (message) {
			toast.error(message);
			return;
		}
		const left = removing.kind === "app" ? emailOn : appOn;
		setRemoving(null);
		toast.success(
			left
				? `${removing.kind === "app" ? "Authenticator app" : "Email codes"} removed.`
				: "Two-step verification is off.",
		);
		router.refresh();
	};

	const removingLast = removing && (removing.kind === "app" ? !emailOn : !appOn);

	return (
		<Card className="gap-4" aria-labelledby="two-step-title">
			<div className="flex flex-wrap items-center gap-3">
				<h2 id="two-step-title" className="flex-1">
					Two-step verification
				</h2>
				<Badge variant={enabled ? "success" : "neutral"}>
					{enabled ? "On" : "Not set up"}
				</Badge>
			</div>
			<p className="text-body text-fg-secondary">
				After your password, you&apos;ll enter a 6-digit code from an authenticator app or
				your email. It stops someone with your password from signing in.
			</p>

			{factors.map((factor) => (
				<MethodRow
					key={factor.id}
					icon={<Smartphone />}
					title="Authenticator app"
					meta={`Added ${dayjs(factor.createdAt).format("D MMM YYYY")}`}
					badge={<Badge variant="success">Main method</Badge>}
					onRemove={() => setRemoving({ kind: "app", factor })}
					removeLabel="Remove authenticator app"
					busy={busy}
				/>
			))}

			{emailOn && (
				<MethodRow
					icon={<Mail />}
					title="Email code"
					meta={`Sent to ${email}`}
					badge={
						<Badge variant={appOn ? "neutral" : "success"}>
							{appOn ? "Backup" : "Main method"}
						</Badge>
					}
					onRemove={() => setRemoving({ kind: "email" })}
					removeLabel="Remove email codes"
					busy={busy}
				/>
			)}

			{!settingUp && (!appOn || !emailOn) && (
				<div className="grid gap-3 sm:grid-cols-2">
					{!appOn && (
						<MethodOption
							accent
							icon={<Smartphone />}
							title="Authenticator app"
							hint={
								emailOn
									? "Stronger than email. Works without signal."
									: "Recommended. Works without signal."
							}
							onClick={startEnroll}
							busy={busy}
						/>
					)}
					{!emailOn && (
						<MethodOption
							icon={<Mail />}
							title="Email code"
							hint={
								appOn
									? `A backup for when your phone isn't with you. Codes go to ${email}.`
									: `A code to ${email} each time you sign in.`
							}
							onClick={startEmail}
							busy={busy}
						/>
					)}
				</div>
			)}

			{pending && (
				<div className="flex flex-col gap-5 rounded-md border border-line bg-subtle p-5">
					<ol className="flex list-decimal flex-col gap-2 ps-5 text-body">
						<li>
							Open an authenticator app on your phone, such as Google Authenticator or
							Microsoft Authenticator.
						</li>
						<li>
							Tap <strong>Add account</strong>, then scan this code.
						</li>
					</ol>
					<div className="flex flex-wrap items-center gap-6">
						{/* Supabase returns an inline SVG data URI for the TOTP QR code */}
						{/* eslint-disable-next-line @next/next/no-img-element */}
						<img
							src={pending.qrCode}
							alt="QR code for your authenticator app"
							className="size-44 rounded-md border border-line bg-white p-2"
						/>
						<div className="flex min-w-0 flex-1 basis-52 flex-col gap-2">
							<span className="text-overline font-bold tracking-[0.06em] text-fg-secondary uppercase">
								Can&apos;t scan? Type this key
							</span>
							<code className="rounded-md bg-surface px-3 py-2 text-center font-mono text-body break-all text-fg">
								{pending.secret}
							</code>
						</div>
					</div>
					<div className="flex flex-col gap-2">
						<span className="text-body font-bold">Then enter the 6-digit code</span>
						<OtpInput length={6} value={code} onChange={setCode} disabled={busy} />
					</div>
					<div className="flex flex-wrap gap-3">
						<Button
							variant="primary"
							disabled={code.length !== 6 || busy}
							onClick={confirmEnroll}
						>
							{busy ? "Checking…" : "Verify and turn on"}
						</Button>
						<Button disabled={busy} onClick={cancelEnroll}>
							Cancel
						</Button>
					</div>
				</div>
			)}

			{emailSetup && (
				<div className="flex flex-col gap-5 rounded-md border border-line bg-subtle p-5">
					<p className="text-body">
						We sent a 6-digit code to <strong>{email}</strong>. Enter it to turn on
						email codes. It expires in 10 minutes.
					</p>
					<div className="flex flex-col gap-2">
						<span className="text-body font-bold">6-digit code</span>
						<OtpInput
							length={6}
							value={code}
							onChange={setCode}
							disabled={busy}
							autoFocus
						/>
					</div>
					<div className="flex flex-wrap items-center gap-3">
						<Button
							variant="primary"
							disabled={code.length !== 6 || busy}
							onClick={confirmEmail}
						>
							{busy ? "Checking…" : "Verify and turn on"}
						</Button>
						<Button disabled={busy} onClick={resendEmail}>
							Send a new code
						</Button>
						<Button
							variant="ghost"
							disabled={busy}
							onClick={() => {
								setEmailSetup(false);
								setCode("");
							}}
						>
							Cancel
						</Button>
					</div>
				</div>
			)}

			{removing && (
				<ConfirmDialog
					title={
						removingLast
							? "Turn off two-step verification?"
							: removing.kind === "app"
								? "Remove the authenticator app?"
								: "Remove email codes?"
					}
					confirmLabel={removingLast ? "Turn off" : "Remove"}
					onCancel={() => setRemoving(null)}
					onConfirm={remove}
				>
					{removingLast
						? "Your account will be protected by your password alone until you set it up again."
						: removing.kind === "app"
							? "You'll get sign-in codes by email instead until you add an app again."
							: "You'll use your authenticator app only. Keep it with you when you sign in."}
				</ConfirmDialog>
			)}
		</Card>
	);
}

/** A method that's set up: icon, name, detail, badge and a remove button. */
function MethodRow({
	icon,
	title,
	meta,
	badge,
	onRemove,
	removeLabel,
	busy,
}: {
	icon: ReactNode;
	title: string;
	meta: string;
	badge: ReactNode;
	onRemove: () => void;
	removeLabel: string;
	busy: boolean;
}) {
	return (
		<div className="flex items-center gap-3 rounded-md border border-line p-4">
			<MethodIcon>{icon}</MethodIcon>
			<span className="flex min-w-0 flex-1 flex-col text-body">
				<strong>{title}</strong>
				<span className="text-small break-all text-fg-tertiary">{meta}</span>
			</span>
			{badge}
			<IconButton
				danger
				aria-label={removeLabel}
				title="Remove"
				disabled={busy}
				onClick={onRemove}
			>
				<Trash2 aria-hidden="true" />
			</IconButton>
		</div>
	);
}

/** A method that can be set up: press to start. */
function MethodOption({
	icon,
	title,
	hint,
	onClick,
	busy,
	accent,
}: {
	icon: ReactNode;
	title: string;
	hint: string;
	onClick: () => void;
	busy: boolean;
	accent?: boolean;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={busy}
			className="flex cursor-pointer items-start gap-3 rounded-md border border-line p-4 text-start transition-colors hover:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60"
		>
			<MethodIcon accent={accent}>{icon}</MethodIcon>
			<span className="flex flex-col text-body">
				<strong>{title}</strong>
				<span className="text-small text-fg-tertiary">{hint}</span>
			</span>
		</button>
	);
}

function MethodIcon({ accent, children }: { accent?: boolean; children: ReactNode }) {
	return (
		<span
			aria-hidden="true"
			className={`grid size-10 shrink-0 place-items-center rounded-full [&_svg]:size-5 ${
				accent ? "bg-accent-subtle text-accent-fg" : "bg-subtle text-fg-secondary"
			}`}
		>
			{children}
		</span>
	);
}
