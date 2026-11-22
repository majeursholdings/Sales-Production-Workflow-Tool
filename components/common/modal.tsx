"use client";

import type { ReactNode } from "react";
import { Button } from "./buttons";

/**
 * Confirm dialog for every delete / remove / archive.
 * Render conditionally: `{open && <ConfirmDialog ... />}`.
 */
export function ConfirmDialog({
	title,
	children,
	confirmLabel = "Delete",
	cancelLabel = "Cancel",
	onConfirm,
	onCancel,
}: {
	title: string;
	children: ReactNode;
	confirmLabel?: string;
	cancelLabel?: string;
	onConfirm: () => void;
	onCancel: () => void;
}) {
	return (
		<div
			className="fixed inset-0 z-40 grid place-items-center bg-[rgb(33_29_26/0.45)] p-6 print:hidden"
			onClick={onCancel}
			onKeyDown={(e) => e.key === "Escape" && onCancel()}
		>
			<div
				role="alertdialog"
				aria-modal="true"
				aria-label={title}
				onClick={(e) => e.stopPropagation()}
				className="flex max-h-[calc(100vh-48px)] w-110 max-w-full flex-col gap-4 overflow-auto rounded-lg border border-line bg-surface p-6 shadow-[0_16px_48px_rgb(33_29_26/0.2)]"
			>
				<span
					aria-hidden="true"
					className="grid size-10 place-items-center rounded-full bg-danger-subtle text-danger-fg"
				>
					<svg
						viewBox="0 0 24 24"
						className="size-5"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<path d="M12 9v4M12 17h.01" />
						<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
					</svg>
				</span>
				<h2 className="text-lg leading-snug">{title}</h2>
				<div className="text-body text-fg-secondary">{children}</div>
				<div className="flex flex-wrap justify-end gap-3">
					<Button autoFocus onClick={onCancel}>
						{cancelLabel}
					</Button>
					<Button variant="danger-solid" onClick={onConfirm}>
						{confirmLabel}
					</Button>
				</div>
			</div>
		</div>
	);
}
