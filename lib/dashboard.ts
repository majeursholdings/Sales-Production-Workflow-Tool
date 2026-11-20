import type { BadgeVariant } from "@/components/common/badge";
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

export type AttentionItem = {
	id: string;
	tag: string;
	tone: BadgeVariant;
	title: string;
	detail: string;
	/** Where the button goes. Ignored when `followUp` is set. */
	cta: string;
	href: string;
	/** A client to follow up with: the button becomes an Email / WhatsApp / Call menu. */
	followUp?: {
		client: string;
		email: string;
		whatsapp: string;
		phone: string;
		subject: string;
		message: string;
	};
};

export type ProductionRow = {
	id: string;
	href?: string;
	client: string;
	items: string;
	stage: { label: string; tone: BadgeVariant };
	due: string;
};

export type DeliveryItem = { date: string; tone: BadgeVariant; client: string; detail: string };
export type PipelineRow = { label: string; amount: number; tone: BadgeVariant };
export type FeedItem = { who: string; text: string; when: string };

export type DashboardData = {
	/** What this role's figures cover, shown after the date. */
	scope: string;
	overview: OverviewItem[];
	attention: AttentionItem[];
	/** Job cards in production. Left out for roles that don't work with them. */
	production?: ProductionRow[];
	deliveries?: DeliveryItem[];
	pipeline?: PipelineRow[];
	feed: FeedItem[];
};

const ATTENTION: Record<string, AttentionItem> = {
	expiring: {
		id: "expiring",
		tag: "Expiring",
		tone: "warning",
		title: "Ngozi Adeyemi: quote expires tomorrow",
		detail: "King bed frame, 2 nightstands · ₦1,085,600.00 · created by Chiamaka Eze",
		cta: "Follow up",
		href: "/quotes",
		followUp: {
			client: "Ngozi Adeyemi",
			email: "ngozi.adeyemi@yahoo.com",
			whatsapp: "2348091234455",
			phone: "+2348091234455",
			subject: "Your Majeurs quote expires tomorrow",
			message: "Hi Ngozi, a quick reminder that your Majeurs quote expires tomorrow.",
		},
	},
	nodep: {
		id: "nodep",
		tag: "Sent",
		tone: "info",
		title: "Fatima Bello: no deposit 2 days after sending",
		detail: "3-door wardrobe · deposit due ₦578,550.00",
		cta: "Open quote",
		href: "/quotes",
	},
	reqs: {
		id: "reqs",
		tag: "2 requests",
		tone: "neutral",
		title: "Custom costs waiting for procurement",
		detail: "Curved headboard (Adaeze Okafor) · Brass name plate (Harbourview Suites)",
		cta: "Review",
		href: "/cost-requests",
	},
	short: {
		id: "short",
		tag: "Short",
		tone: "danger",
		title: "2 parts short for JC-20261107-0031",
		detail: "Walnut slab ×1, woven paper cord 16 m · Tunde Bakare",
		cta: "View shortfall",
		href: "/inventory",
	},
	draft: {
		id: "draft",
		tag: "Draft",
		tone: "neutral",
		title: "Finish Adaeze Okafor’s quote",
		detail: "3-seater sofa, coffee table · last edited 17:42",
		cta: "Continue",
		href: "/quotes",
	},
	low: {
		id: "low",
		tag: "Low",
		tone: "warning",
		title: "High-density foam 40D below reorder level",
		detail: "6 available, reorder at 6 · used in all sofas",
		cta: "Reorder",
		href: "/inventory",
	},
	poApprove: {
		id: "poApprove",
		tag: "Approval",
		tone: "warning",
		title: "Purchase order over ₦1,000,000 needs your approval",
		detail: "MAJ-PO-20261102-1410 · Ogun Timber Co. · ₦1,110,000.00 · raised by Ifeanyi Nwosu",
		cta: "Review",
		href: "/purchase-orders",
	},
	expired: {
		id: "expired",
		tag: "Expired",
		tone: "danger",
		title: "Kola Martins: quote expired without a deposit",
		detail: "Office desks × 4 · ₦1,672,000.00 · make a new version to send again",
		cta: "New version",
		href: "/quotes",
	},
	plates: {
		id: "plates",
		tag: "Waiting",
		tone: "neutral",
		title: "CR-0013 brass name plates not priced yet",
		detail: "Harbourview Suites · needed by Tue, 10 Nov",
		cta: "View request",
		href: "/cost-requests",
	},
	balance: {
		id: "balance",
		tag: "Balance",
		tone: "warning",
		title: "Tunde Bakare: ₦967,500.00 balance due before delivery",
		detail: "MAJ-INV-20261107-1750 · delivery planned 28 Nov",
		cta: "Open invoice",
		href: "/invoices",
	},
	harbour: {
		id: "harbour",
		tag: "Balance",
		tone: "warning",
		title: "Harbourview Suites: ₦3,576,000.00 balance due by 21 Nov",
		detail: "MAJ-INV-20261105-1120 · in upholstery now",
		cta: "Open invoices",
		href: "/invoices",
	},
	fx: {
		id: "fx",
		tag: "Rate",
		tone: "neutral",
		title: "Check Monday’s dollar rate before 10:00",
		detail: "Today’s rate ₦1,460.00 is locked onto quotes sent in USD",
		cta: "Update rate",
		href: "/settings/tax",
	},
	blocked: {
		id: "blocked",
		tag: "Blocked",
		tone: "danger",
		title: "JC-20261107-0031 can’t start cutting",
		detail: "Waiting on walnut slab and woven paper cord · POs drafted by procurement",
		cta: "Open job card",
		href: "/work-orders",
	},
	dueSoon: {
		id: "dueSoon",
		tag: "Due 12 Nov",
		tone: "info",
		title: "Moyo & Okeke reception desk is in finishing",
		detail: "JC-20261030-0027 · quality check next",
		cta: "Open job card",
		href: "/work-orders",
	},
};

const ATTENTION_BY_ROLE: Record<string, string[]> = {
	md: ["poApprove", "expiring", "nodep", "short", "reqs"],
	care: ["expiring", "nodep", "draft"],
	sales: ["expired", "plates", "nodep"],
	proc: ["reqs", "short", "low"],
	acct: ["balance", "harbour", "fx"],
	prod: ["blocked", "dueSoon"],
};

const SCOPE: Record<string, string> = {
	md: "All teams",
	care: "Your quotes and clients",
	proc: "Stock, costs and requests",
	sales: "Your quotes, clients and trade accounts",
	acct: "Payments, invoices and rates",
	prod: "Job cards and workshop",
};

const PRODUCTION: ProductionRow[] = [
	{
		id: "JC-20261105-0029",
		href: "/work-orders/JC-20261105-0029",
		client: "Harbourview Suites",
		items: "Lobby lounge chairs × 12",
		stage: { label: "Upholstery", tone: "info" },
		due: "21 Nov 2026",
	},
	{
		id: "JC-20261107-0031",
		client: "Tunde Bakare",
		items: "Dining table, 6 chairs",
		stage: { label: "Waiting on parts", tone: "warning" },
		due: "28 Nov 2026",
	},
	{
		id: "JC-20261030-0027",
		client: "Moyo & Okeke Interiors",
		items: "Reception desk",
		stage: { label: "Finishing", tone: "success" },
		due: "12 Nov 2026",
	},
];

const DELIVERIES: DeliveryItem[] = [
	{
		date: "12 Nov",
		tone: "success",
		client: "Moyo & Okeke Interiors",
		detail: "Reception desk · installer collects",
	},
	{
		date: "21 Nov",
		tone: "info",
		client: "Harbourview Suites",
		detail: "12 lounge chairs · Victoria Island",
	},
	{
		date: "28 Nov",
		tone: "warning",
		client: "Tunde Bakare",
		detail: "Dining table, 6 chairs · GRA Ikeja",
	},
];

const PIPELINE: PipelineRow[] = [
	{ label: "Draft", amount: 1196335.25, tone: "neutral" },
	{ label: "Sent", amount: 3383000, tone: "info" },
	{ label: "Expiring soon", amount: 1085600, tone: "warning" },
	{ label: "Deposit paid", amount: 8940000, tone: "success" },
	{ label: "Expired", amount: 1672000, tone: "danger" },
];

const FEED: FeedItem[] = [
	{
		who: "BL",
		text: "Bisi Lawal recorded a ₦5,364,000.00 deposit for Harbourview Suites",
		when: "5 Nov, 11:20",
	},
	{ who: "EO", text: "Emeka Obi sent a quote to Tunde Bakare", when: "6 Nov, 10:42" },
	{
		who: "IN",
		text: "Ifeanyi Nwosu imported the November price list (46 costs)",
		when: "2 Nov, 09:30",
	},
	{ who: "CE", text: "Chiamaka Eze started a quote for Adaeze Okafor", when: "Today, 17:42" },
];

export async function getDashboard(role: string): Promise<DashboardData> {
	const key = ROLE_SETS.find(([match]) => match.test(role))?.[1] ?? "care";
	return {
		scope: SCOPE[key],
		overview: SAMPLE[key],
		attention: ATTENTION_BY_ROLE[key].map((id) => ATTENTION[id]),
		production: key === "care" || key === "sales" ? undefined : PRODUCTION,
		deliveries: key === "prod" ? DELIVERIES : undefined,
		pipeline: key === "prod" ? undefined : PIPELINE,
		feed: FEED,
	};
}
