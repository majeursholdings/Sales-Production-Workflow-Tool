"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";
import type { SelectFilterItem } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// OptionsMenu — a labelled select ("Type  All ⌄"), behind every table filter
// and sort (SelectFilter, DateSortFilter). It's the design's `.sel` control: a
// small grey label beside a native select, so it behaves on touch screens too.
// ─────────────────────────────────────────────────────────────────────────────

export function OptionsMenu({
	items,
	value,
	onChange,
	resetLabel,
	label,
}: {
	items: SelectFilterItem[];
	/** The chosen item's value — "" for none. */
	value: string;
	onChange: (value: string) => void;
	/** The first option, which clears the choice. */
	resetLabel: string;
	/** Small text beside the select, e.g. "Type" or "Sort by". */
	label: string;
}) {
	const id = useId();

	return (
		<div className="inline-flex max-w-full items-center gap-2 text-small text-fg-secondary">
			<label htmlFor={id} className="whitespace-nowrap">
				{label}
			</label>
			<select
				id={id}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				className={cn(
					"h-10 max-w-full cursor-pointer rounded-md border border-line-control bg-surface pr-8 pl-3 text-fg",
					"focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
					value && "font-bold",
				)}
			>
				<option value="">{resetLabel}</option>
				{items.map((item) => (
					<option key={item.value} value={item.value}>
						{item.label}
					</option>
				))}
			</select>
		</div>
	);
}
