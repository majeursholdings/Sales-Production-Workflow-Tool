"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";
import { RATING_WORDS } from "@/lib/suppliers";

/** One criterion rated 1 to 5: a row of five radio buttons with what the chosen number means. */
export default function RatingPicker({
	label,
	hint,
	value,
	onChange,
	error,
}: {
	label: string;
	hint: string;
	/** 0 while nothing is picked. */
	value: number;
	onChange: (value: number) => void;
	error?: string;
}) {
	const id = useId();
	return (
		<div className="flex flex-col gap-2 border-t border-line py-4 first:border-t-0 first:pt-0">
			<div className="flex flex-wrap items-baseline gap-2">
				<span id={id} className="flex-1 text-body font-bold">
					{label}
				</span>
				<span className="text-small text-fg-tertiary">
					{value ? `${value} · ${RATING_WORDS[value]}` : "Not rated"}
				</span>
			</div>
			<span className="text-small text-fg-tertiary">{hint}</span>
			<div
				role="radiogroup"
				aria-labelledby={id}
				aria-describedby={error ? `${id}-msg` : undefined}
				className="inline-flex gap-0.5 self-start rounded-md bg-subtle p-0.5"
			>
				{[1, 2, 3, 4, 5].map((n) => (
					<button
						key={n}
						type="button"
						role="radio"
						aria-checked={value === n}
						aria-label={`${label} ${n} of 5, ${RATING_WORDS[n].toLowerCase()}`}
						onClick={() => onChange(n)}
						className={cn(
							"h-11 min-w-11 cursor-pointer rounded-sm border border-transparent px-3 text-body text-fg-secondary tabular hover:text-fg",
							"focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus",
							value === n && "border-line bg-surface font-bold text-fg",
						)}
					>
						{n}
					</button>
				))}
			</div>
			{error && (
				<small id={`${id}-msg`} role="alert" className="text-small text-danger-fg">
					{error}
				</small>
			)}
		</div>
	);
}
