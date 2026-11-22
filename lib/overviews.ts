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

// ─── Detail pages ────────────────────────────────────────────────────────────
// One record per supplier. Sample records only (all
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

export async function getSupplierDetail(id: string) {
	return SUPPLIERS[id] ?? null;
}

/** Ids with a sample record, so the detail routes can be prerendered. */
export const sampleSupplierIds = Object.keys(SUPPLIERS);
