import { cn } from "@/lib/cn";

/** Hours worked against hours planned. Turns warning-coloured once over; the figures beside it carry the meaning. */
export default function HoursBar({ actual, planned }: { actual: number; planned: number }) {
	const pct = planned ? Math.min(100, (actual / planned) * 100) : 0;
	return (
		<span
			aria-hidden="true"
			className="relative block h-1.5 w-24 shrink-0 rounded-full bg-line"
		>
			<span
				className={cn(
					"absolute inset-y-0 start-0 rounded-full",
					actual > planned ? "bg-warning-fg" : "bg-accent",
				)}
				style={{ width: `${pct}%` }}
			/>
		</span>
	);
}
