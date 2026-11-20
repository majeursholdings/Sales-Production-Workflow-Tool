import type { ReactNode } from "react";
import { Plus } from "lucide-react";
import { Button, LinkButton } from "@/components/common/buttons";

// ─────────────────────────────────────────────────────────────────────────────
// ToolbarActionButton — the solid "+ Add new client" button anchored to the
// right of the toolbar via TableToolbar's `actions`. The view's one primary action.
// ─────────────────────────────────────────────────────────────────────────────

export interface ToolbarActionButtonProps {
	label: string;
	onClick?: () => void;
	href?: string;
	icon?: ReactNode;
	/** Greyed out and not clickable (a button only), e.g. until something else is set up. */
	disabled?: boolean;
}

export function ToolbarActionButton({
	label,
	onClick,
	href,
	icon,
	disabled = false,
}: ToolbarActionButtonProps) {
	const content = (
		<>
			{icon ?? <Plus />}
			{label}
		</>
	);

	if (href) {
		return (
			<LinkButton href={href} variant="primary">
				{content}
			</LinkButton>
		);
	}

	return (
		<Button variant="primary" onClick={onClick} disabled={disabled}>
			{content}
		</Button>
	);
}
