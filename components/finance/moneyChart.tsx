"use client";

import { useState } from "react";
import { Card, CardHeader } from "@/components/common/card";
import { SegmentedControl } from "@/components/common/segmented-control";
import { Table } from "@/components/tables";
import { cn } from "@/lib/cn";
import { naira, nairaCompact, niceAxis, type Bucket, type Totals } from "@/lib/finance";

type View = "chart" | "table";

const grainText = { day: "Daily", week: "Weekly", month: "Monthly" } as const;

/** Revenue and expenditure side by side for each day, week or month, with a table view of the same figures. */
export default function MoneyChart({
	buckets,
	grain,
	totals,
}: {
	buckets: Bucket[];
	grain: keyof typeof grainText;
	totals: Totals;
}) {
	const [view, setView] = useState<View>("chart");
	const axis = niceAxis(Math.max(0, ...buckets.flatMap((b) => [b.revenue, b.expenditure])));
	const height = (value: number) => `${(value / axis.top) * 100}%`;

	return (
		<Card flush aria-labelledby="money-chart-title" className="overflow-hidden">
			<CardHeader>
				<div className="flex min-w-0 flex-1 basis-60 flex-col gap-0.5">
					<h2 id="money-chart-title">Money in and out</h2>
					<p className="text-small text-fg-tertiary">{grainText[grain]} totals</p>
				</div>
				<ul className="flex flex-wrap gap-x-5 gap-y-2 text-small">
					<LegendItem swatch="bg-accent" label="Revenue" value={naira(totals.revenue)} />
					<LegendItem
						swatch="bg-info-fg"
						label="Expenditure"
						value={naira(totals.expenditure)}
					/>
				</ul>
				<SegmentedControl<View>
					label="Show as"
					value={view}
					onChange={setView}
					options={[
						{ value: "chart", label: "Chart" },
						{ value: "table", label: "Table" },
					]}
				/>
			</CardHeader>

			{view === "chart" ? (
				<div className="px-5 pt-7 pb-5">
					<div className="relative ms-15 h-60 border-b border-line-control">
						{axis.values.map((tick) => (
							<div
								key={tick}
								aria-hidden="true"
								className="absolute inset-x-0 border-t border-line"
								style={{ bottom: height(tick) }}
							>
								<span className="absolute inset-e-[calc(100%+8px)] -top-2.5 text-xs whitespace-nowrap text-fg-tertiary tabular">
									{nairaCompact(tick)}
								</span>
							</div>
						))}
						<div className="absolute inset-0 flex">
							{buckets.map((b, i) => (
								<button
									key={b.full}
									type="button"
									aria-label={`${b.full}: revenue ${naira(b.revenue)}, expenditure ${naira(b.expenditure)}, net ${naira(b.net)}`}
									className="group relative flex min-w-0 flex-1 cursor-default items-end justify-center gap-0.5 rounded-t-md px-1 hover:bg-accent-subtle focus-visible:bg-accent-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
								>
									<span
										className="w-5 max-w-5 min-w-0.75 flex-[0_1_20px] rounded-t-sm bg-accent"
										style={{ height: height(b.revenue) }}
									/>
									<span
										className="w-5 max-w-5 min-w-0.75 flex-[0_1_20px] rounded-t-sm bg-info-fg"
										style={{ height: height(b.expenditure) }}
									/>
									<span
										aria-hidden="true"
										className={cn(
											"pointer-events-none absolute bottom-full z-10 mb-1 hidden min-w-50 flex-col gap-1 rounded-lg border border-line bg-surface p-3 text-start text-small text-fg shadow-[0_8px_24px_rgb(33_29_26/0.14)] group-hover:flex group-focus-visible:flex",
											i < buckets.length / 3
												? "inset-s-0"
												: i >= (buckets.length * 2) / 3
													? "inset-e-0"
													: "inset-s-1/2 -translate-x-1/2",
										)}
									>
										<span className="text-xs text-fg-tertiary">{b.full}</span>
										<TipRow
											swatch="bg-accent"
											value={naira(b.revenue)}
											label="Revenue"
										/>
										<TipRow
											swatch="bg-info-fg"
											value={naira(b.expenditure)}
											label="Expenditure"
										/>
										<TipRow
											swatch="bg-fg-tertiary"
											value={naira(b.net)}
											label="Net"
										/>
									</span>
								</button>
							))}
						</div>
					</div>
					<div aria-hidden="true" className="ms-15 flex pt-2">
						{buckets.map((b) => (
							<span
								key={b.full}
								className="min-w-0 flex-1 text-center text-xs whitespace-nowrap text-fg-tertiary"
							>
								{buckets.length > 16 && buckets.indexOf(b) % 2 === 1 ? "" : b.label}
							</span>
						))}
					</div>
				</div>
			) : (
				<Table className="min-w-130 [&_td:not(:first-child)]:text-end [&_th:not(:first-child)]:text-end">
					<caption className="sr-only">
						Revenue and expenditure, {grainText[grain].toLowerCase()}
					</caption>
					<thead>
						<tr>
							<th scope="col">Period</th>
							<th scope="col">Revenue</th>
							<th scope="col">Expenditure</th>
							<th scope="col">Net</th>
						</tr>
					</thead>
					<tbody>
						{buckets.map((b) => (
							<tr key={b.full}>
								<td>{b.full}</td>
								<td className="tabular">{naira(b.revenue)}</td>
								<td className="tabular">{naira(b.expenditure)}</td>
								<td className="font-bold text-fg tabular">{naira(b.net)}</td>
							</tr>
						))}
					</tbody>
				</Table>
			)}
		</Card>
	);
}

function LegendItem({ swatch, label, value }: { swatch: string; label: string; value: string }) {
	return (
		<li className="inline-flex items-center gap-2">
			<i aria-hidden="true" className={cn("size-3 rounded-xs", swatch)} />
			{label} <b className="tabular">{value}</b>
		</li>
	);
}

function TipRow({ swatch, value, label }: { swatch: string; value: string; label: string }) {
	return (
		<span className="flex items-center gap-2">
			<i aria-hidden="true" className={cn("h-0.5 w-3 rounded-xs", swatch)} />
			<b className="tabular">{value}</b>
			<span className="text-fg-tertiary">{label}</span>
		</span>
	);
}
