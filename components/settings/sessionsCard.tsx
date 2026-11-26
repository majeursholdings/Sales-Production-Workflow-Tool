"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/common/badge";
import { Button } from "@/components/common/buttons";
import { Card } from "@/components/common/card";
import { ConfirmDialog } from "@/components/common/modal";
import { signOutOtherDevices } from "@/lib/securityActions";

/** Where you're signed in. The auth service can only sign out the *other* sessions in one go, so that's what's offered. */
export default function SessionsCard() {
	const [confirming, setConfirming] = useState(false);

	const signOutOthers = async () => {
		const result = await signOutOtherDevices();
		setConfirming(false);
		if (!result.ok) {
			toast.error(result.message);
			return;
		}
		toast.success("Signed out of your other devices.");
	};

	return (
		<Card className="gap-3" aria-labelledby="sessions-title">
			<h2 id="sessions-title">Where you&apos;re signed in</h2>
			<div className="flex items-center gap-3">
				<span className="flex min-w-0 flex-1 flex-col text-body">
					<strong>This browser</strong>
					<span className="text-small text-fg-tertiary">Active now</span>
				</span>
				<Badge variant="success">This device</Badge>
			</div>
			<Button
				variant="danger"
				size="sm"
				className="self-start"
				onClick={() => setConfirming(true)}
			>
				<LogOut />
				Sign out everywhere else
			</Button>

			{confirming && (
				<ConfirmDialog
					title="Sign out everywhere else?"
					confirmLabel="Sign out"
					onCancel={() => setConfirming(false)}
					onConfirm={signOutOthers}
				>
					Every device except this one is signed out straight away and will need two-step
					verification again. Unsaved quote drafts on those devices are kept as drafts.
				</ConfirmDialog>
			)}
		</Card>
	);
}
