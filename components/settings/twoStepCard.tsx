"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";
import { Smartphone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/common/badge";
import { Button } from "@/components/common/buttons";
import { Card } from "@/components/common/card";
import { ConfirmDialog } from "@/components/common/modal";
import OtpInput from "@/components/forms/otpInput";
import { IconButton } from "@/components/tables";
import { createClient } from "@/utils/supabase/client";

export type EnrolledFactor = {
	id: string;
	friendlyName: string;
	/** ISO date the factor was added. */
	createdAt: string;
};

type PendingEnrollment = { factorId: string; qrCode: string; secret: string };

/** Two-step verification with an authenticator app. */
export default function TwoStepCard({ factors }: { factors: EnrolledFactor[] }) {
	const router = useRouter();
	const [pending, setPending] = useState<PendingEnrollment | null>(null);
	const [code, setCode] = useState("");
	const [busy, setBusy] = useState(false);
	const [removing, setRemoving] = useState<EnrolledFactor | null>(null);

	const enabled = factors.length > 0;

	const startEnroll = async () => {
		setBusy(true);
		const supabase = createClient();
		const { data, error } = await supabase.auth.mfa.enroll({
			factorType: "totp",
			friendlyName: `Authenticator app ${dayjs().format("D MMM YYYY HH:mm")}`,
		});
		setBusy(false);

		if (error || !data) {
			toast.error(error?.message ?? "Could not start two-step verification setup.");
			return;
		}
		setPending({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
		setCode("");
	};

	// Drops the unverified factor so setting up again later starts clean
	const cancelEnroll = async () => {
		if (!pending) return;
		setBusy(true);
		await createClient().auth.mfa.unenroll({ factorId: pending.factorId });
		setBusy(false);
		setPending(null);
		setCode("");
	};

	const confirmEnroll = async () => {
		if (!pending || code.length !== 6) return;
		setBusy(true);
		const { error } = await createClient().auth.mfa.challengeAndVerify({
			factorId: pending.factorId,
			code,
		});
		setBusy(false);

		if (error) {
			toast.error(
				"That code didn't work. Codes change every 30 seconds, so use the newest one.",
			);
			setCode("");
			return;
		}
		setPending(null);
		setCode("");
		toast.success("Two-step verification is on. You'll be asked for a code when you sign in.");
		router.refresh();
	};

	const removeFactor = async () => {
		if (!removing) return;
		setBusy(true);
		const { error } = await createClient().auth.mfa.unenroll({ factorId: removing.id });
		setBusy(false);

		if (error) {
			toast.error(error.message);
			return;
		}
		setRemoving(null);
		toast.success("Two-step verification is off.");
		router.refresh();
	};

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
				After your password, you&apos;ll enter a 6-digit code from an authenticator app. It
				stops someone with your password from signing in.
			</p>

			{enabled &&
				factors.map((factor) => (
					<div
						key={factor.id}
						className="flex items-center gap-3 rounded-md border border-line p-4"
					>
						<MethodIcon />
						<span className="flex min-w-0 flex-1 flex-col text-body">
							<strong>Authenticator app</strong>
							<span className="text-small text-fg-tertiary">
								Added {dayjs(factor.createdAt).format("D MMM YYYY")}
							</span>
						</span>
						<Badge variant="success">Main method</Badge>
						<IconButton
							danger
							aria-label="Remove authenticator app"
							title="Remove"
							disabled={busy}
							onClick={() => setRemoving(factor)}
						>
							<Trash2 aria-hidden="true" />
						</IconButton>
					</div>
				))}

			{!enabled && !pending && (
				<button
					type="button"
					onClick={startEnroll}
					disabled={busy}
					className="flex cursor-pointer items-start gap-3 rounded-md border border-line p-4 text-start transition-colors hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-60 sm:max-w-sm"
				>
					<MethodIcon accent />
					<span className="flex flex-col text-body">
						<strong>Authenticator app</strong>
						<span className="text-small text-fg-tertiary">
							Recommended. Works without signal.
						</span>
					</span>
				</button>
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

			{removing && (
				<ConfirmDialog
					title="Turn off two-step verification?"
					confirmLabel="Turn off"
					onCancel={() => setRemoving(null)}
					onConfirm={removeFactor}
				>
					Your account will be protected by your password alone until you set it up again.
				</ConfirmDialog>
			)}
		</Card>
	);
}

function MethodIcon({ accent }: { accent?: boolean }) {
	return (
		<span
			aria-hidden="true"
			className={`grid size-10 shrink-0 place-items-center rounded-full ${
				accent ? "bg-accent-subtle text-accent-fg" : "bg-subtle text-fg-secondary"
			}`}
		>
			<Smartphone className="size-5" />
		</span>
	);
}
