import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Panel: surface, hairline border, 10px radius, 20px padding. Use `flush` when it holds a table or card-head. */
export function Card({
	flush,
	className,
	...props
}: { flush?: boolean } & ComponentProps<"section">) {
	return (
		<section
			className={cn(
				"flex flex-col rounded-lg border border-line bg-surface",
				flush ? "gap-0" : "gap-3 p-5",
				className,
			)}
			{...props}
		/>
	);
}

export function CardHeader({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"flex flex-wrap items-center gap-3 border-b border-line px-5 py-4",
				className,
			)}
			{...props}
		/>
	);
}

export function CardTitle({ className, ...props }: ComponentProps<"h3">) {
	return <h3 className={cn("text-h3 font-bold", className)} {...props} />;
}

/** Overview strip: one bordered panel, figures split by hairline dividers. */
export function StatGrid({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] overflow-hidden rounded-lg border border-line bg-surface",
				className,
			)}
			{...props}
		/>
	);
}

export function Stat({
	label,
	value,
	note,
	tone,
}: {
	label: string;
	value: ReactNode;
	note?: ReactNode;
	tone?: "warning" | "danger";
}) {
	return (
		<div
			className={cn(
				"flex min-w-0 flex-col gap-1 px-5 py-4 shadow-[-1px_0_0_var(--border-default),0_-1px_0_var(--border-default)]",
				tone === "warning" && "bg-warning-subtle",
				tone === "danger" && "bg-danger-subtle",
			)}
		>
			<span className="text-small text-fg-secondary">{label}</span>
			<b className="font-display text-total tabular">{value}</b>
			{note && <span className="text-small text-fg-tertiary">{note}</span>}
		</div>
	);
}

/** Inline callout / note: subtle accent fill. */
export function Callout({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"flex flex-col gap-1 rounded-md bg-accent-subtle p-3 text-body text-fg",
				className,
			)}
			{...props}
		/>
	);
}

export function Avatar({ initials, className }: { initials: string; className?: string }) {
	return (
		<span
			aria-hidden="true"
			className={cn(
				"grid size-8 shrink-0 place-items-center rounded-full bg-subtle text-small text-fg-secondary",
				className,
			)}
		>
			{initials}
		</span>
	);
}
