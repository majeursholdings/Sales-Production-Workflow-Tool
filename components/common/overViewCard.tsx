import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type OverviewTone = "warning" | "danger";

export type OverviewItem = {
	label: string;
	/** The headline figure, e.g. "₦16,276,935.25" or "3". */
	value: ReactNode;
	/** Small line under the figure, e.g. "6 quotes". */
	note?: ReactNode;
	/** Tint the cell when the figure needs attention. Tone is never the only signal: keep the note's text meaningful. */
	tone?: OverviewTone;
	/**
	 * Turns the note into a change-over-time line, e.g. "Up 12.4% vs previous period".
	 * `good` says whether that direction is good news (spending going up is not).
	 * The arrow and the wording carry the meaning, not just the colour.
	 */
	trend?: { direction: "up" | "down" | "flat"; good?: boolean };
};

const tones: Record<OverviewTone, string> = {
	warning: "bg-warning-subtle",
	danger: "bg-danger-subtle",
};

const trendIcons = { up: ArrowUp, down: ArrowDown, flat: Minus };

/** One figure: label, value and an optional note. Must sit inside a <dl> (OverviewCards does this). */
export function OverviewCard({ label, value, note, tone, trend }: OverviewItem) {
	const TrendIcon = trend ? trendIcons[trend.direction] : null;

	return (
		<div
			className={cn(
				// the hairline dividers are the cell's top and left edges, so they only show between cells
				"flex min-w-0 flex-col gap-1 px-5 py-4 shadow-[-1px_0_0_var(--border-default),0_-1px_0_var(--border-default)] max-md:px-4 max-md:py-3",
				tone && tones[tone],
			)}
		>
			<dt className="text-small text-fg-secondary">{label}</dt>
			<dd className="font-display text-total tabular max-md:text-h2">{value}</dd>
			{note && trend && TrendIcon ? (
				<dd
					className={cn(
						"flex items-center gap-1 text-small [&_svg]:size-4 [&_svg]:shrink-0",
						trend.direction === "flat" && "text-fg-tertiary",
						trend.direction !== "flat" &&
							(trend.good ? "text-success-fg" : "text-danger-fg"),
					)}
				>
					<TrendIcon aria-hidden="true" />
					{note}
				</dd>
			) : (
				note && <dd className="text-small text-fg-tertiary">{note}</dd>
			)}
		</div>
	);
}

/**
 * Overview strip: one bordered panel with the figures split by hairline
 * dividers. Two across on a phone, otherwise as many as fit.
 */
export default function OverviewCards({
	items,
	className,
	...props
}: {
	items: OverviewItem[];
	className?: string;
	"aria-label"?: string;
}) {
	return (
		<dl
			className={cn(
				"grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] overflow-hidden rounded-lg border border-line bg-surface max-md:grid-cols-2",
				className,
			)}
			{...props}
		>
			{items.map((item) => (
				<OverviewCard key={item.label} {...item} />
			))}
		</dl>
	);
}
