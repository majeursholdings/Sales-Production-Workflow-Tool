import type { OverviewItem } from "@/components/common/overViewCard";
import { buildInvoicesOverview, getInvoices } from "@/lib/invoices";

/**
 * TODO: replace with real figures once the data exists.
 * Sample figures for each page's overview cards, so the layout can be
 * reviewed. Quotes and Invoices add up the sample rows in the design; the
 * other pages use illustrative numbers. Each page only reads its figures
 * through here, so swapping in real data is a one-file change.
 */

export async function getQuotesOverview(): Promise<OverviewItem[]> {
	return [
		{
			label: "Open quotes",
			value: "₦6,112,770.50",
			note: "4 quotes in Draft, Sent or Expiring soon",
		},
		{ label: "Deposits due", value: "₦3,128,020.00", note: "70% of sent quotes, not yet paid" },
		{ label: "Deposits recorded", value: "₦6,258,000.00", note: "Orders now in production" },
		{
			label: "Expiring soon",
			value: "1",
			note: "Follow up before they lapse",
			tone: "warning",
		},
	];
}

export async function getInvoicesOverview(): Promise<OverviewItem[]> {
	return buildInvoicesOverview(await getInvoices());
}

export async function getFinanceOverview(): Promise<OverviewItem[]> {
	return [
		{
			label: "Revenue",
			value: "₦14,200,000",
			note: "Up 12.4% vs previous period",
			trend: { direction: "up", good: true },
		},
		{
			label: "Expenditure",
			value: "₦9,150,000",
			note: "Up 18.1% vs previous period",
			trend: { direction: "up", good: false },
		},
		{
			label: "Net (revenue − expenditure)",
			value: "₦5,050,000",
			note: "Up 3.2% vs previous period",
			trend: { direction: "up", good: true },
		},
		{
			label: "Net margin",
			value: "35.6%",
			note: "Down 3.0 points vs previous period",
			trend: { direction: "down", good: false },
		},
	];
}

export async function getJobCardsOverview(): Promise<OverviewItem[]> {
	return [
		{ label: "Active job cards", value: "3", note: "1 waiting on parts, 0 in redo" },
		{ label: "Hours logged this week", value: "126 h", note: "Across all job cards" },
		{ label: "Redos this month", value: "1", note: "Upholstery re-stitch" },
		{
			label: "Rejected deliveries",
			value: "1",
			note: "Harbourview Suites: 2 of 12",
			tone: "danger",
		},
	];
}

// ─── Detail pages ────────────────────────────────────────────────────────────
// One record per supplier or job card. Sample records only (all
// illustrative); an id with no record returns null so the page can 404.

export type DetailOverview = {
	title: string;
	description: string;
	badge?: { label: string; variant?: "neutral" | "info" | "success" | "warning" | "danger" };
	overview: OverviewItem[];
};

const SUPPLIERS: Record<string, DetailOverview> = {
	"ogun-timber-co": {
		title: "Ogun Timber Co.",
		description: "Timber supplier. Procurement rates each material it supplies.",
		overview: [
			{ label: "Overall rating", value: "4.6 / 5", note: "Average of 3 rated materials" },
			{ label: "Preferred supplier for", value: "2", note: "Walnut slab, Oak plank" },
			{ label: "Deliveries", value: "92% on time", note: "11 deliveries" },
			{ label: "Paid this year", value: "₦6,420,000.00", note: "1 open purchase order" },
		],
	},
};

const JOB_CARDS: Record<string, DetailOverview> = {
	"JC-20261105-0029": {
		title: "Harbourview Suites",
		description: "JC-20261105-0029 · Lobby lounge chairs × 12",
		badge: { label: "Upholstery", variant: "info" },
		overview: [
			{ label: "Production hours", value: "84 h", note: "of 120 h planned · 70%" },
			{ label: "Machine hours", value: "18 h", note: "of 24 h planned · updates Machines" },
			{ label: "Redo hours", value: "4 h", note: "Upholstery re-stitch" },
			{ label: "Due", value: "21 Nov 2026", note: "4 days left" },
		],
	},
};

export async function getSupplierDetail(id: string) {
	return SUPPLIERS[id] ?? null;
}
export async function getJobCardDetail(id: string) {
	return JOB_CARDS[id] ?? null;
}

/** Ids with a sample record, so the detail routes can be prerendered. */
export const sampleSupplierIds = Object.keys(SUPPLIERS);
export const sampleJobCardIds = Object.keys(JOB_CARDS);
