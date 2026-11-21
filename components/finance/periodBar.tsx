"use client";

import { useState } from "react";
import dayjs from "dayjs";
import { Button } from "@/components/common/buttons";
import { PERIOD_OPTIONS, describeRange, type DateRange, type Period } from "@/lib/finance";

const controlClass =
	"h-10 rounded-md border border-line-control bg-surface px-3 text-body text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

/** Period select, with From / To and Apply for a custom range, and what the figures are compared with. */
export default function PeriodBar({
	period,
	onPeriodChange,
	range,
	custom,
	previous,
	today,
	earliest,
	onApplyCustom,
}: {
	period: Period;
	onPeriodChange: (period: Period) => void;
	range: DateRange;
	/** The applied custom range; the From / To fields start from it. */
	custom: DateRange;
	previous: DateRange;
	today: string;
	/** Earliest date with entries, YYYY-MM-DD. */
	earliest: string;
	onApplyCustom: (range: DateRange) => void;
}) {
	const [from, setFrom] = useState(custom.start);
	const [to, setTo] = useState(custom.end);
	const [error, setError] = useState<string | null>(null);

	const apply = () => {
		if (!from || !to) {
			setError("Choose both a start and an end date.");
			return;
		}
		if (dayjs(from).isAfter(dayjs(to))) {
			setError("The start date must be on or before the end date.");
			return;
		}
		setError(null);
		onApplyCustom({ start: from, end: to });
	};

	return (
		<div role="group" aria-label="Date range" className="flex flex-wrap items-center gap-3">
			<label className="flex items-center gap-2 text-small text-fg-secondary">
				Period
				<select
					className={controlClass}
					value={period}
					onChange={(e) => {
						setError(null);
						onPeriodChange(e.target.value as Period);
					}}
				>
					{PERIOD_OPTIONS.map((o) => (
						<option key={o.value} value={o.value}>
							{o.label}
						</option>
					))}
				</select>
			</label>

			{period === "custom" && (
				<>
					<label className="flex items-center gap-2 text-small text-fg-secondary">
						From
						<input
							type="date"
							className={controlClass}
							value={from}
							min={earliest}
							max={today}
							onChange={(e) => setFrom(e.target.value)}
							aria-invalid={error ? true : undefined}
						/>
					</label>
					<label className="flex items-center gap-2 text-small text-fg-secondary">
						To
						<input
							type="date"
							className={controlClass}
							value={to}
							min={earliest}
							max={today}
							onChange={(e) => setTo(e.target.value)}
							aria-invalid={error ? true : undefined}
						/>
					</label>
					<Button onClick={apply}>Apply</Button>
				</>
			)}

			<span className="text-small text-fg-tertiary md:ms-auto">
				{describeRange(range)} · compared with {describeRange(previous)}
			</span>

			{error && (
				<p role="alert" className="basis-full text-small text-danger-fg">
					{error}
				</p>
			)}
		</div>
	);
}
