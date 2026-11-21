import { DEPOSIT_RATE, MAX_GENERAL_DISCOUNT, USD_RATE, VALID_DAYS } from "@/lib/quoteBuilder";
import { VAT_RATE } from "@/lib/quotes";

export type MarkupCategory = {
	id: string;
	name: string;
	/** How many furniture types are in the category. */
	types: number;
	/** The markup now, as a percentage. */
	markup: number;
	/** The most the markup can be, as a percentage. */
	ceiling: number;
	/** A cost to show the price for. */
	exampleCost: number;
};

export type PricingRule = { label: string; who: string; value: string };
export type PricingChange = { what: string; who: string };

/**
 * TODO: replace with real settings once there's a backend.
 * The sample values from the Pricing & margins design. The page only reads
 * them through here, so swapping in real data is a one-file change.
 */
export async function getMarkupCategories(): Promise<MarkupCategory[]> {
	return [
		{ id: "sofas", name: "Sofas", types: 4, markup: 35, ceiling: 40, exampleCost: 646200 },
		{ id: "tables", name: "Tables", types: 6, markup: 30, ceiling: 35, exampleCost: 185000 },
		{ id: "beds", name: "Beds", types: 3, markup: 32, ceiling: 38, exampleCost: 540000 },
		{ id: "chairs", name: "Chairs", types: 5, markup: 28, ceiling: 35, exampleCost: 160000 },
		{ id: "storage", name: "Storage", types: 4, markup: 30, ceiling: 36, exampleCost: 610000 },
		{ id: "office", name: "Office", types: 3, markup: 25, ceiling: 30, exampleCost: 334400 },
	];
}

export async function getPricingRules(): Promise<PricingRule[]> {
	return [
		{ label: "VAT", who: "Set by Accounting", value: `${VAT_RATE * 100}%` },
		{
			label: "Deposit to confirm",
			who: "Accounting, MD and GM",
			value: `${Math.round(DEPOSIT_RATE * 100)}%`,
		},
		{ label: "Quote validity", who: "MD or GM only", value: `${VALID_DAYS} days` },
		{
			label: "General discount",
			who: "Most staff can give; not for trade clients",
			value: `Up to ${MAX_GENERAL_DISCOUNT}%`,
		},
		{
			label: "Trade tiers",
			who: "Paid in the last 365 days since joining",
			value: "5 / 10 / 20%",
		},
		{
			label: "USD rate",
			who: "Set daily by Accounting",
			value: `₦${USD_RATE.toLocaleString("en-NG")} / $`,
		},
	];
}

export async function getPricingHistory(): Promise<PricingChange[]> {
	return [
		{ what: "Office markup 28% → 25%", who: "Bisi Lawal (Accounting) · 2 Nov 2026, 14:05" },
		{
			what: "Price list imported: 46 part costs updated",
			who: "Ifeanyi Nwosu (Procurement) · 2 Nov 2026, 09:30",
		},
		{ what: "Deposit 50% → 70%", who: "Managing Director · 15 Oct 2026, 11:20" },
		{ what: "Sofas ceiling 38% → 40%", who: "General Manager · 1 Oct 2026, 16:45" },
	];
}
