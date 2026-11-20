import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/**
 * Button variants from the design system:
 *  primary   — the one main action per view (solid accent)
 *  secondary — outlined, neutral
 *  ghost     — text-only, hover fill
 *  danger    — outlined destructive
 *  danger-solid — rare filled destructive confirm
 */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "danger-solid";
export type ButtonSize = "md" | "sm";

const base =
	"inline-flex items-center justify-center gap-2 rounded-md border border-transparent font-bold whitespace-nowrap " +
	"select-none cursor-pointer transition-colors no-underline " +
	"focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus " +
	"disabled:cursor-not-allowed disabled:bg-subtle disabled:border-line disabled:text-fg-tertiary " +
	"aria-disabled:cursor-not-allowed aria-disabled:bg-subtle aria-disabled:border-line aria-disabled:text-fg-tertiary " +
	"[&_svg]:shrink-0";

const variants: Record<ButtonVariant, string> = {
	primary: "bg-accent text-on-accent hover:bg-accent-hover hover:text-on-accent",
	secondary: "bg-surface border-line-control text-fg hover:bg-subtle hover:text-fg",
	ghost: "bg-transparent text-fg hover:bg-subtle hover:text-fg",
	danger: "bg-surface border-danger-line text-danger-fg hover:bg-danger-subtle hover:text-danger-fg",
	"danger-solid": "bg-danger text-on-accent hover:bg-danger-hover hover:text-on-accent",
};

const sizes = {
	md: "h-10 px-4 text-body [&_svg]:size-5",
	sm: "h-8 px-3 text-body [&_svg]:size-4",
} satisfies Record<ButtonSize, string>;

type StyleProps = {
	variant?: ButtonVariant;
	size?: ButtonSize;
	/** Square icon-only button. Pass an aria-label. */
	icon?: boolean;
	className?: string;
};

export function buttonClasses({
	variant = "secondary",
	size = "md",
	icon,
	className,
}: StyleProps = {}) {
	const square = icon ? (size === "sm" ? "w-8 px-0" : "w-10 px-0") : "";
	return [base, variants[variant], sizes[size], square, className].filter(Boolean).join(" ");
}

export function Button({
	variant,
	size,
	icon,
	className,
	type = "button",
	...props
}: StyleProps & ComponentProps<"button">) {
	return (
		<button
			type={type}
			className={buttonClasses({ variant, size, icon, className })}
			{...props}
		/>
	);
}

export function LinkButton({
	variant,
	size,
	icon,
	className,
	children,
	...props
}: StyleProps & ComponentProps<typeof Link> & { children?: ReactNode }) {
	return (
		<Link className={buttonClasses({ variant, size, icon, className })} {...props}>
			{children}
		</Link>
	);
}
