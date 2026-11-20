import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/**
 * Styled table. Use plain <thead>, <tbody>, <tr>, <th scope="col">, <td> inside.
 * Numeric columns (money, counts) are right-aligned with tabular figures:
 *   <td className="text-end tabular whitespace-nowrap">
 */
export function Table({ className, ...props }: ComponentProps<"table">) {
	return (
		<div className="overflow-x-auto">
			<table
				className={cn(
					"w-full border-collapse text-body",
					"[&_th]:bg-subtle [&_th]:px-3 [&_th]:py-2 [&_th]:text-start [&_th]:text-overline [&_th]:font-bold [&_th]:tracking-[0.06em] [&_th]:whitespace-nowrap [&_th]:text-fg-secondary [&_th]:uppercase",
					"[&_td]:border-t [&_td]:border-line [&_td]:p-3 [&_td]:align-middle [&_td]:text-fg-secondary",
					"[&_tbody_tr:hover_td]:bg-page",
					className,
				)}
				{...props}
			/>
		</div>
	);
}

const iconButtonClass = (danger?: boolean, className?: string) =>
	cn(
		"inline-grid size-8 cursor-pointer place-items-center rounded-md text-fg-secondary no-underline hover:bg-subtle hover:text-fg [&_svg]:size-4.5",
		danger && "hover:bg-danger-subtle hover:text-danger-fg",
		className,
	);

/** Icon-only row action. Always pass aria-label and title. */
export function IconButton({
	danger,
	className,
	type = "button",
	...props
}: { danger?: boolean } & ComponentProps<"button">) {
	return <button type={type} className={iconButtonClass(danger, className)} {...props} />;
}

/** Icon-only navigation action (a link that looks like IconButton). Always pass aria-label and title. */
export function IconLink({
	danger,
	className,
	...props
}: { danger?: boolean } & ComponentProps<typeof Link>) {
	return <Link className={iconButtonClass(danger, className)} {...props} />;
}
