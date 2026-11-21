"use client";

import { Suspense, useState } from "react";
import dayjs from "dayjs";
import { Download, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/common/buttons";
import OverviewCards from "@/components/common/overViewCard";
import PageTitle from "@/components/layout/pageTitle";
import type { FinanceData } from "@/lib/data/finance";
import {
	CATEGORY_LABELS,
	bucketize,
	breakdown,
	buildOverview,
	describeRange,
	inRange,
	naira,
	previousRange,
	resolveRange,
	totalsOf,
	vatSummary,
	type DateRange,
	type FinanceEntry,
	type Period,
} from "@/lib/finance";
import EntriesTable, { exportEntries, toEntryRows } from "./entriesTable";
import EntriesTableSkeleton from "./entriesTableSkeleton";
import { financeTitle } from "./financeTitle";
import MoneyChart from "./moneyChart";
import PeriodBar from "./periodBar";
import RecordExpenseDrawer, { type ExpenseValues } from "./recordExpenseDrawer";
import { BreakdownCard, OwedCard, VatCard } from "./sideCards";

/**
 * The page title (with "Record expense"), the period bar and everything computed from it:
 * the figures, chart, entries and the side cards. They all follow the chosen period, so they live together here.
 */
export default function FinancePageContent({
	data,
	recordedBy,
}: {
	data: FinanceData;
	/** Name shown against expenses recorded in this session. */
	recordedBy: string;
}) {
	const { today, owed } = data;
	const [recorded, setRecorded] = useState<FinanceEntry[]>([]);
	const [period, setPeriod] = useState<Period>("month");
	const [custom, setCustom] = useState<DateRange>(() => ({
		start: dayjs(today).subtract(29, "day").format("YYYY-MM-DD"),
		end: today,
	}));
	const [recording, setRecording] = useState(false);

	// newest first, with anything recorded here
	const all = [...recorded, ...data.entries].sort((a, b) => b.date.localeCompare(a.date));
	const earliest = data.entries.reduce((min, e) => (e.date < min ? e.date : min), today);

	const range = resolveRange(period, custom, today);
	const previous = previousRange(range);
	const current = inRange(all, range);
	const totals = totalsOf(current);
	const previousTotals = totalsOf(inRange(all, previous));
	const { buckets, grain } = bucketize(current, range);
	const rangeText = describeRange(range);

	const saveExpense = (values: ExpenseValues) => {
		const stamp = dayjs(values.date).format("YYYYMMDD");
		const entry: FinanceEntry = {
			id: `exp-${Date.now()}`,
			date: values.date,
			kind: "out",
			category: values.category,
			amount: Number(values.amount),
			description: `${CATEGORY_LABELS[values.category]}: ${values.paidTo.trim()}`,
			reference: values.reference.trim() || `MAJ-EXP-${stamp}-${dayjs().format("HHmm")}`,
			recordedBy,
		};
		setRecorded((prev) => [entry, ...prev]);
		setRecording(false);
		toast.success(`Expense of ${naira(entry.amount)} recorded for ${values.paidTo.trim()}.`);
	};

	const downloadReport = () =>
		exportEntries(
			toEntryRows(current),
			"csv",
			"Revenue & expenses",
			`revenue-expenses-${range.start}-to-${range.end}`,
		);

	return (
		<>
			<PageTitle
				{...financeTitle}
				actions={
					<>
						<Button onClick={downloadReport} disabled={current.length === 0}>
							<Download />
							Download report
						</Button>
						<Button variant="primary" onClick={() => setRecording(true)}>
							<Plus />
							Record expense
						</Button>
					</>
				}
			/>

			<PeriodBar
				// a fresh draft of From / To each time the applied range changes
				key={`${custom.start}-${custom.end}`}
				period={period}
				onPeriodChange={setPeriod}
				range={range}
				custom={custom}
				previous={previous}
				today={today}
				earliest={earliest}
				onApplyCustom={setCustom}
			/>

			<OverviewCards
				aria-label="Revenue and expenses overview"
				items={buildOverview(totals, previousTotals)}
			/>

			<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
				<div className="flex min-w-0 flex-col gap-6">
					<MoneyChart buckets={buckets} grain={grain} totals={totals} />
					{/* the table keeps its search, filters and page in the URL, which needs Suspense on a static page */}
					<Suspense fallback={<EntriesTableSkeleton />}>
						<EntriesTable
							entries={current}
							rangeText={rangeText}
							exportName={`entries-${range.start}-to-${range.end}`}
						/>
					</Suspense>
				</div>

				<aside
					aria-label="Breakdowns, what is owed and VAT"
					className="flex min-w-0 flex-col gap-6"
				>
					<BreakdownCard
						kind="in"
						rows={breakdown(current, "in")}
						total={totals.revenue}
						rangeText={rangeText}
					/>
					<BreakdownCard
						kind="out"
						rows={breakdown(current, "out")}
						total={totals.expenditure}
						rangeText={rangeText}
					/>
					<OwedCard owed={owed} />
					<VatCard vat={vatSummary(current)} />
				</aside>
			</div>

			{recording && (
				<RecordExpenseDrawer
					today={today}
					earliest={earliest}
					onSave={saveExpense}
					onClose={() => setRecording(false)}
				/>
			)}
		</>
	);
}
