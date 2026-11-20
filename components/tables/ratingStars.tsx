import { Star } from "lucide-react";
import { cn } from "@/lib/cn";

// ─────────────────────────────────────────────────────────────────────────────
// RatingStars — star display for an average rating.
// ─────────────────────────────────────────────────────────────────────────────

export function RatingStars({ value, max = 5 }: { value: number; max?: number }) {
	return (
		<div role="img" aria-label={`${value} out of ${max}`} className="flex items-center gap-0.5">
			{Array.from({ length: max }).map((_, i) => (
				<Star
					key={i}
					aria-hidden="true"
					className={cn(
						"size-3.5",
						i < Math.round(value)
							? "fill-brand-gold text-brand-gold"
							: "fill-subtle text-line-strong",
					)}
				/>
			))}
		</div>
	);
}
