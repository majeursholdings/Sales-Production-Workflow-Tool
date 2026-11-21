import dayjs from "dayjs";
import type { OverviewItem } from "@/components/common/overViewCard";

export type EntryKind = "in" | "out";

export type FinanceCategory =
	"dep" | "bal" | "mat" | "wag" | "rent" | "pow" | "del" | "out" | "oth";

/** One line of money in (a client payment) or out (a supplier, wage or running cost). Amounts are naira, VAT included. */
export type FinanceEntry = {
	id: string;
	/** YYYY-MM-DD */
	date: string;
	kind: EntryKind;
	category: FinanceCategory;
	amount: number;
	description: string;
	reference: string;
	recordedBy: string;
	/** Where the source document lives, e.g. the invoice or purchase order. */
	href?: string;
};

export const CATEGORY_LABELS: Record<FinanceCategory, string> = {
	dep: "Deposits",
	bal: "Balance payments",
	mat: "Materials & parts",
	wag: "Wages & labour",
	rent: "Workshop rent & overheads",
	pow: "Power & diesel",
	del: "Delivery & installation",
	out: "Outsourced work",
	oth: "Other",
};

export const INCOME_CATEGORIES: FinanceCategory[] = ["dep", "bal"];
export const EXPENSE_CATEGORIES: FinanceCategory[] = [
	"mat",
	"wag",
	"rent",
	"pow",
	"del",
	"out",
	"oth",
];
/** Categories a person can record by hand. Materials come from purchase orders, so they're not offered. */
export const RECORDABLE_CATEGORIES: FinanceCategory[] = EXPENSE_CATEGORIES.filter(
	(c) => c !== "mat",
);

export const PAYMENT_METHODS = [
	{ value: "transfer", label: "Bank transfer" },
	{ value: "cash", label: "Cash" },
	{ value: "pos", label: "POS / card" },
] as const;

export const VAT_RATE = 0.075;

// ── Periods ──────────────────────────────────────────────────────────────

export type Period = "month" | "30" | "90" | "365" | "custom";

export const PERIOD_OPTIONS: { value: Period; label: string }[] = [
	{ value: "month", label: "This month" },
	{ value: "30", label: "Last 30 days" },
	{ value: "90", label: "Last 90 days" },
	{ value: "365", label: "Last 12 months" },
	{ value: "custom", label: "Custom range" },
];

export type DateRange = { start: string; end: string };

const DATE = "YYYY-MM-DD";

export function resolveRange(period: Period, custom: DateRange, today: string): DateRange {
	const end = dayjs(today);
	switch (period) {
		case "month":
			return { start: end.startOf("month").format(DATE), end: today };
		case "custom":
			return custom;
		default:
			return { start: end.subtract(Number(period) - 1, "day").format(DATE), end: today };
	}
}

/** The stretch of equal length just before `range`, used for "vs previous period". */
export function previousRange({ start, end }: DateRange): DateRange {
	const days = dayjs(end).diff(dayjs(start), "day") + 1;
	return {
		start: dayjs(start).subtract(days, "day").format(DATE),
		end: dayjs(start).subtract(1, "day").format(DATE),
	};
}

export function describeRange({ start, end }: DateRange): string {
	const a = dayjs(start);
	const b = dayjs(end);
	if (start === end) return b.format("D MMM YYYY");
	if (a.year() !== b.year()) return `${a.format("D MMM YYYY")} – ${b.format("D MMM YYYY")}`;
	if (a.month() !== b.month()) return `${a.format("D MMM")} – ${b.format("D MMM YYYY")}`;
	return `${a.date()}–${b.format("D MMM YYYY")}`;
}

export const inRange = (entries: FinanceEntry[], { start, end }: DateRange) =>
	entries.filter((e) => e.date >= start && e.date <= end);

// ── Totals ───────────────────────────────────────────────────────────────

export type Totals = { revenue: number; expenditure: number; net: number; margin: number | null };

export function totalsOf(entries: FinanceEntry[]): Totals {
	let revenue = 0;
	let expenditure = 0;
	for (const e of entries) {
		if (e.kind === "in") revenue += e.amount;
		else expenditure += e.amount;
	}
	const net = revenue - expenditure;
	return { revenue, expenditure, net, margin: revenue > 0 ? (net / revenue) * 100 : null };
}

export const naira = (n: number) =>
	`${n < 0 ? "−" : ""}₦${Math.round(Math.abs(n)).toLocaleString("en-NG")}`;

export const nairaCompact = (n: number) =>
	n === 0 ? "₦0" : n >= 1e6 ? `₦${+(n / 1e6).toFixed(1)}M` : `₦${+(n / 1e3).toFixed(0)}K`;

function trendFor(
	current: number,
	previous: number,
	goodWhenUp: boolean,
): Pick<OverviewItem, "note" | "trend"> {
	if (previous === 0) {
		return { note: "No entries in the previous period", trend: { direction: "flat" } };
	}
	const pct = ((current - previous) / Math.abs(previous)) * 100;
	if (Math.abs(pct) < 0.05) {
		return { note: "No change vs previous period", trend: { direction: "flat" } };
	}
	const up = pct > 0;
	return {
		note: `${up ? "Up" : "Down"} ${Math.abs(pct).toFixed(1)}% vs previous period`,
		trend: { direction: up ? "up" : "down", good: up === goodWhenUp },
	};
}

/** The four headline figures, each compared with the previous period. */
export function buildOverview(current: Totals, previous: Totals): OverviewItem[] {
	const marginNote: Pick<OverviewItem, "note" | "trend"> =
		current.margin === null || previous.margin === null
			? { note: "Needs revenue in both periods", trend: { direction: "flat" } }
			: (() => {
					const diff = current.margin - previous.margin;
					if (Math.abs(diff) < 0.05) {
						return {
							note: "No change vs previous period",
							trend: { direction: "flat" as const },
						};
					}
					return {
						note: `${diff > 0 ? "Up" : "Down"} ${Math.abs(diff).toFixed(1)} points vs previous period`,
						trend: {
							direction: diff > 0 ? ("up" as const) : ("down" as const),
							good: diff > 0,
						},
					};
				})();

	return [
		{
			label: "Revenue",
			value: naira(current.revenue),
			...trendFor(current.revenue, previous.revenue, true),
		},
		{
			label: "Expenditure",
			value: naira(current.expenditure),
			...trendFor(current.expenditure, previous.expenditure, false),
		},
		{
			label: "Net (revenue − expenditure)",
			value: naira(current.net),
			...trendFor(current.net, previous.net, true),
		},
		{
			label: "Net margin",
			value: current.margin === null ? "—" : `${current.margin.toFixed(1)}%`,
			...marginNote,
		},
	];
}

// ── Chart buckets ────────────────────────────────────────────────────────

export type Bucket = {
	/** Short axis label, e.g. "12 Oct" or "Oct". */
	label: string;
	/** Full label for tooltips and the table, e.g. "12–18 Oct 2026". */
	full: string;
	revenue: number;
	expenditure: number;
	net: number;
};

/** Days → daily bars; up to ~3 months → weekly; longer → monthly. */
export function bucketize(
	entries: FinanceEntry[],
	{ start, end }: DateRange,
): {
	buckets: Bucket[];
	grain: "day" | "week" | "month";
} {
	const first = dayjs(start);
	const last = dayjs(end);
	const days = last.diff(first, "day") + 1;
	const grain = days <= 14 ? "day" : days <= 92 ? "week" : "month";

	const edges: { from: dayjs.Dayjs; to: dayjs.Dayjs }[] = [];
	if (grain === "month") {
		for (let m = first.startOf("month"); !m.isAfter(last); m = m.add(1, "month")) {
			edges.push({
				from: m.isBefore(first) ? first : m,
				to: m.endOf("month").isAfter(last) ? last : m.endOf("month"),
			});
		}
	} else {
		const step = grain === "day" ? 1 : 7;
		for (let d = first; !d.isAfter(last); d = d.add(step, "day")) {
			const to = d.add(step - 1, "day");
			edges.push({ from: d, to: to.isAfter(last) ? last : to });
		}
	}

	const buckets = edges.map(({ from, to }) => {
		const slice = entries.filter(
			(e) => e.date >= from.format(DATE) && e.date <= to.format(DATE),
		);
		const t = totalsOf(slice);
		const sameDay = from.isSame(to, "day");
		return {
			label: grain === "month" ? from.format("MMM") : from.format("D MMM"),
			full:
				grain === "month"
					? from.format("MMMM YYYY")
					: sameDay
						? from.format("D MMM YYYY")
						: describeRange({ start: from.format(DATE), end: to.format(DATE) }),
			revenue: t.revenue,
			expenditure: t.expenditure,
			net: t.net,
		};
	});
	return { buckets, grain };
}

/** A round upper bound and tick values for the chart's y axis. */
export function niceAxis(max: number, ticks = 4): { top: number; values: number[] } {
	if (max <= 0) return { top: 1, values: [0] };
	const rough = max / ticks;
	const mag = 10 ** Math.floor(Math.log10(rough));
	const step = ([1, 2, 2.5, 5, 10].find((m) => m * mag >= rough) ?? 10) * mag;
	const top = step * Math.ceil(max / step);
	const values: number[] = [];
	for (let v = 0; v <= top + step / 2; v += step) values.push(v);
	return { top, values };
}

// ── Breakdowns and VAT ───────────────────────────────────────────────────

export type CategoryRow = {
	category: FinanceCategory;
	amount: number;
	count: number;
	share: number;
};

export function breakdown(entries: FinanceEntry[], kind: EntryKind): CategoryRow[] {
	const of = entries.filter((e) => e.kind === kind);
	const total = of.reduce((sum, e) => sum + e.amount, 0);
	const cats = kind === "in" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
	return cats
		.map((category) => {
			const rows = of.filter((e) => e.category === category);
			const amount = rows.reduce((sum, e) => sum + e.amount, 0);
			return { category, amount, count: rows.length, share: total > 0 ? amount / total : 0 };
		})
		.filter((row) => row.count > 0)
		.sort((a, b) => b.amount - a.amount);
}

const vatIn = (amount: number) => amount - amount / (1 + VAT_RATE);

export function vatSummary(entries: FinanceEntry[]) {
	const collected = entries
		.filter((e) => e.kind === "in")
		.reduce((s, e) => s + vatIn(e.amount), 0);
	const paid = entries
		.filter((e) => e.kind === "out" && e.category === "mat")
		.reduce((s, e) => s + vatIn(e.amount), 0);
	return { collected, paid, toRemit: collected - paid };
}
