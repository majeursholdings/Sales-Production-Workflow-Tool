"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/common/buttons";
import { ConfirmDialog } from "@/components/common/modal";
import { Drawer } from "@/components/common/drawer";

// ─────────────────────────────────────────────────────────────────────────────
// TableDialog — what a row's Edit and Delete actions open.
//   delete → the confirm dialog (every delete is confirmed)
//   edit   → a right-hand drawer with Cancel / Save
// ─────────────────────────────────────────────────────────────────────────────

export function TableDialog({
	open,
	onClose,
	onConfirm,
	variant,
	title,
	confirmLabel,
	children,
}: {
	open: boolean;
	onClose: () => void;
	onConfirm: () => void;
	variant: "edit" | "delete";
	title: string;
	confirmLabel: string;
	children: ReactNode;
}) {
	if (!open) return null;

	if (variant === "delete") {
		return (
			<ConfirmDialog
				title={title}
				confirmLabel={confirmLabel}
				onConfirm={onConfirm}
				onCancel={onClose}
			>
				{children}
			</ConfirmDialog>
		);
	}

	return (
		<Drawer
			title={title}
			onClose={onClose}
			footer={
				<>
					<span className="flex-1" />
					<Button onClick={onClose}>Cancel</Button>
					<Button variant="primary" onClick={onConfirm}>
						{confirmLabel}
					</Button>
				</>
			}
		>
			{children}
		</Drawer>
	);
}
