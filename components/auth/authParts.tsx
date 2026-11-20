import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { ArrowLeft, CircleAlert } from "lucide-react";
import { cn } from "@/lib/cn";

/** Page title with an optional line under it. */
export function AuthHeading({ title, children }: { title: string; children?: ReactNode }) {
	return (
		<div className="flex flex-col gap-1">
			<h1>{title}</h1>
			{children && <p className="text-body text-fg-secondary">{children}</p>}
		</div>
	);
}

/** Form-level error. role="alert" so a screen reader announces it when it appears. */
export function AuthAlert({ children }: { children: ReactNode }) {
	return (
		<div
			role="alert"
			className="flex items-start gap-3 rounded-md border border-danger-line bg-danger-subtle px-4 py-3 text-body text-danger-fg"
		>
			<CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
			<span className="flex-1">{children}</span>
		</div>
	);
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
	return (
		<Link href={href} className="inline-flex items-center gap-1 self-start text-body">
			<ArrowLeft aria-hidden="true" className="size-4" />
			{children}
		</Link>
	);
}

/** Round icon badge for the "check your email" / "done" states. */
export function AuthBadge({
	tone = "accent",
	children,
}: {
	tone?: "accent" | "success";
	children: ReactNode;
}) {
	return (
		<span
			aria-hidden="true"
			className={cn(
				"grid size-12 place-items-center rounded-full [&_svg]:size-6",
				tone === "accent"
					? "bg-accent-subtle text-accent-fg"
					: "bg-success-subtle text-success-fg",
			)}
		>
			{children}
		</span>
	);
}

export function AuthNote({ className, ...props }: ComponentProps<"p">) {
	return <p className={cn("text-small text-fg-tertiary", className)} {...props} />;
}

/** Looks like a link, behaves like a button — for in-page actions such as "send it again". */
export function TextButton({ className, type = "button", ...props }: ComponentProps<"button">) {
	return (
		<button
			type={type}
			className={cn(
				"cursor-pointer text-start text-accent-fg underline hover:text-accent-hover disabled:cursor-not-allowed disabled:text-fg-tertiary",
				className,
			)}
			{...props}
		/>
	);
}
