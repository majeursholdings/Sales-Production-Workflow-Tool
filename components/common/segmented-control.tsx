"use client";

import { cn } from "@/lib/cn";

type Option<T extends string> = { value: T; label: string };

/** Controlled segmented control: track = bg-subtle, active segment = surface with border. */
export function SegmentedControl<T extends string>({
	label,
	options,
	value,
	onChange,
	className,
}: {
	label: string;
	options: Option<T>[];
	value: T;
	onChange: (value: T) => void;
	className?: string;
}) {
	return (
		<div
			role="group"
			aria-label={label}
			className={cn("inline-flex flex-wrap gap-0.5 rounded-md bg-subtle p-0.5", className)}
		>
			{options.map((o) => (
				<button
					key={o.value}
					type="button"
					aria-pressed={value === o.value}
					onClick={() => onChange(o.value)}
					className="h-8 cursor-pointer rounded-sm border border-transparent px-3 text-body whitespace-nowrap text-fg-secondary hover:text-fg aria-pressed:border-line aria-pressed:bg-surface aria-pressed:font-bold aria-pressed:text-fg"
				>
					{o.label}
				</button>
			))}
		</div>
	);
}
