import type { OverviewItem } from "@/components/common/overViewCard";

/**
 * TODO: replace with real figures once quotes, payments and stock exist.
 * These are the sample numbers from the dashboard design, one set per role,
 * so the cards can be laid out and reviewed. The page only talks to the
 * dashboard through here, so swapping in real data is a one-file change.
 */
const SAMPLE: Record<string, OverviewItem[]> = {
	md: [
		{ label: "Quoted, last 30 days", value: "₦16,276,935.25", note: "6 quotes" },
		{ label: "Deposits recorded", value: "₦5,364,000.00", note: "1 order confirmed" },
		{ label: "Awaiting deposit", value: "₦2,681,160.00", note: "60% of 3 sent quotes" },
		{
			label: "Expiring this week",
			value: "1",
			note: "Ngozi Adeyemi, tomorrow",
			tone: "warning",
		},
	],
	care: [
		{ label: "My open quotes", value: "3", note: "₦3,246,185.25 in total" },
		{ label: "Awaiting deposit", value: "2", note: "Fatima Bello, Ngozi Adeyemi" },
		{ label: "Drafts", value: "1", note: "Adaeze Okafor" },
		{
			label: "Expiring this week",
			value: "1",
			note: "Ngozi Adeyemi, tomorrow",
			tone: "warning",
		},
	],
	sales: [
		{ label: "My open quotes", value: "2", note: "₦3,383,000.00 sent" },
		{ label: "Won this month", value: "1", note: "Tunde Bakare, ₦2,418,750.00" },
		{ label: "Quote to order, 90 days", value: "42%", note: "5 of 12 quotes" },
		{ label: "Waiting on procurement", value: "1", note: "CR-0013 brass name plates" },
	],
	acct: [
		{ label: "Deposits this month", value: "₦6,815,250.00", note: "2 deposits recorded" },
		{ label: "Balances outstanding", value: "₦4,543,500.00", note: "2 invoices part paid" },
		{ label: "Today’s dollar rate", value: "₦1,460.00", note: "Set at 09:10" },
		{ label: "Supplier bills to pay", value: "₦612,000.00", note: "2 deliveries this week" },
	],
	proc: [
		{ label: "Cost requests", value: "2", note: "Oldest: 3 hours" },
		{ label: "Short for orders", value: "2 parts", note: "JC-20261107-0031", tone: "danger" },
		{ label: "Low stock", value: "3 parts", note: "Below reorder level", tone: "warning" },
		{ label: "Costs updated", value: "2 Nov", note: "46 parts from price list" },
	],
	prod: [
		{ label: "Active job cards", value: "3", note: "1 waiting on parts" },
		{ label: "Due in 7 days", value: "1", note: "Moyo & Okeke, 12 Nov" },
		{ label: "In upholstery", value: "12 pieces", note: "Harbourview Suites" },
		{ label: "Ready for delivery", value: "0", note: "Next: 12 Nov" },
	],
};

// First match wins, same role labels as components/layout/navigation.ts.
const ROLE_SETS: Array<[RegExp, keyof typeof SAMPLE]> = [
	[/director|general manager|md|gm/i, "md"],
	[/accounting/i, "acct"],
	[/procurement/i, "proc"],
	[/production/i, "prod"],
	[/sales/i, "sales"],
];

export async function getDashboardOverview(role: string): Promise<OverviewItem[]> {
	const key = ROLE_SETS.find(([match]) => match.test(role))?.[1] ?? "care";
	return SAMPLE[key];
}
