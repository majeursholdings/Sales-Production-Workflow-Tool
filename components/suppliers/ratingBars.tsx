import { RATING_CRITERIA, type Ratings } from "@/lib/suppliers";

/** Quality, reliability and availability as short bars out of 5, with the number beside each. */
export default function RatingBars({ ratings }: { ratings: Ratings }) {
	return (
		<dl className="flex min-w-40 flex-col gap-1">
			{RATING_CRITERIA.map(({ key, label }) => (
				<div
					key={key}
					className="grid grid-cols-[96px_minmax(0,1fr)_14px] items-center gap-2 text-small text-fg-secondary"
				>
					<dt>{label}</dt>
					<span aria-hidden="true" className="relative h-1.5 rounded-full bg-subtle">
						<span
							className="absolute inset-y-0 start-0 rounded-full bg-accent"
							style={{ width: `${ratings[key] * 20}%` }}
						/>
					</span>
					<dd className="text-end font-bold text-fg tabular">
						<span className="sr-only">{`${ratings[key]} out of 5`}</span>
						<span aria-hidden="true">{ratings[key]}</span>
					</dd>
				</div>
			))}
		</dl>
	);
}
