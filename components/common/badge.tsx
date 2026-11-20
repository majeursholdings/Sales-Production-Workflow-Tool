import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export type BadgeVariant = "neutral" | "info" | "success" | "warning" | "danger";

const variants: Record<BadgeVariant, string> = {
	neutral: "bg-subtle text-fg-secondary border-line",
	info: "bg-info-subtle text-info-fg border-info-line",
	success: "bg-success-subtle text-success-fg border-success-line",
	warning: "bg-warning-subtle text-warning-fg border-warning-line",
	danger: "bg-danger-subtle text-danger-fg border-danger-line",
};

/** Status pill with a leading dot. Colour is never the only signal: always include text. */
export function Badge({
	variant = "neutral",
	className,
	children,
	...props
}: { variant?: BadgeVariant } & ComponentProps<"span">) {
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-small whitespace-nowrap",
				variants[variant],
				className,
			)}
			{...props}
		>
			<span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
			{children}
		</span>
	);
}

/** Neutral tag without a dot (e.g. categories, materials). */
export function Chip({ className, ...props }: ComponentProps<"span">) {
	return (
		<span
			className={cn(
				"inline-flex items-center rounded-sm bg-subtle px-2 py-0.5 text-small whitespace-nowrap text-fg-secondary",
				className,
			)}
			{...props}
		/>
	);
}
