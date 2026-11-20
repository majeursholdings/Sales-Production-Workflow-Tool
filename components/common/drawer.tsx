"use client";

import { useId, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "./buttons";

/**
 * Right-hand drawer for add / edit / view flows (the design's `.drawer`).
 * Render conditionally: `{open && <Drawer ... />}`. Escape and the scrim close it.
 */
export function Drawer({
	title,
	description,
	children,
	footer,
	onClose,
}: {
	title: ReactNode;
	description?: ReactNode;
	children: ReactNode;
	/** Action row pinned to the bottom, e.g. Cancel + Save. */
	footer?: ReactNode;
	onClose: () => void;
}) {
	const titleId = useId();

	return (
		<>
			<div className="fixed inset-0 z-30 bg-[rgb(33_29_26/0.4)]" onClick={onClose} />
			<section
				role="dialog"
				aria-modal="true"
				aria-labelledby={titleId}
				tabIndex={-1}
				// move focus into the drawer when it opens
				ref={(el) => {
					if (el && !el.contains(document.activeElement)) el.focus();
				}}
				onKeyDown={(e) => e.key === "Escape" && onClose()}
				className="fixed inset-y-0 end-0 z-31 flex w-140 max-w-full flex-col border-s border-line bg-surface shadow-[-8px_0_24px_rgb(33_29_26/0.08)] outline-none"
			>
				<div className="flex items-start gap-3 border-b border-line px-6 py-5">
					<div className="flex min-w-0 flex-1 flex-col gap-1">
						<h2 id={titleId}>{title}</h2>
						{description && (
							<p className="text-body text-fg-secondary">{description}</p>
						)}
					</div>
					<Button
						variant="ghost"
						size="sm"
						icon
						aria-label="Close"
						title="Close"
						onClick={onClose}
					>
						<X />
					</Button>
				</div>
				<div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-6 py-5">
					{children}
				</div>
				{footer && (
					<div className="flex flex-wrap items-center gap-3 border-t border-line px-6 py-4">
						{footer}
					</div>
				)}
			</section>
		</>
	);
}
