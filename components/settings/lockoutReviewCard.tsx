"use client";

import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/common/buttons";
import { Card } from "@/components/common/card";
import { confirmLockoutWasMe } from "@/lib/securityActions";

/**
 * Shown after the MD or GM unlocks the account: was the lockout you? "Yes"
 * clears it. "No" asks for a new, stronger password (the password card below
 * opens in its must-change mode); changing it clears this too.
 */
export default function LockoutReviewCard({ onNotMe }: { onNotMe: () => void }) {
	const [busy, setBusy] = useState(false);
	const [notMe, setNotMe] = useState(false);

	const itWasMe = async () => {
		setBusy(true);
		const result = await confirmLockoutWasMe();
		setBusy(false);
		if (!result.ok) {
			toast.error(result.message);
			return;
		}
		toast.success("Thanks. You're all set.");
	};

	return (
		<Card className="gap-4 border-danger-line" aria-labelledby="lockout-title" role="alert">
			<div className="flex items-start gap-3">
				<ShieldAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-danger-fg" />
				<div className="flex flex-col gap-1">
					<h2 id="lockout-title">Was that you?</h2>
					<p className="text-body text-fg-secondary">
						Your account was locked after 5 incorrect passwords, and every device was
						signed out. Your MD or GM has unlocked it.
					</p>
				</div>
			</div>
			{notMe ? (
				<p className="text-body font-bold">
					Change your password below to finish. Choose one you don&apos;t use anywhere
					else.
				</p>
			) : (
				<div className="flex flex-wrap gap-3">
					<Button variant="primary" disabled={busy} onClick={itWasMe}>
						Yes, it was me
					</Button>
					<Button
						variant="danger"
						disabled={busy}
						onClick={() => {
							setNotMe(true);
							onNotMe();
						}}
					>
						No, it wasn&apos;t me
					</Button>
				</div>
			)}
		</Card>
	);
}
