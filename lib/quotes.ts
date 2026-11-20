import type { BadgeVariant } from "@/components/common/badge";

export type QuoteStatus = "draft" | "sent" | "expiring" | "paid" | "expired" | "cancelled";

export const QUOTE_STATUS: Record<QuoteStatus, { label: string; tone: BadgeVariant }> = {
	draft: { label: "Draft", tone: "neutral" },
	sent: { label: "Sent", tone: "info" },
	expiring: { label: "Expiring soon", tone: "warning" },
	paid: { label: "Deposit paid", tone: "success" },
	expired: { label: "Expired", tone: "danger" },
	cancelled: { label: "Cancelled", tone: "danger" },
};

export type Quote = {
	/** The quote number, e.g. MAJ-QT-20261106-1015. It is also what the URL uses. */
	id: string;
	client: string;
	/** One line describing what's quoted. */
	items: string;
	/** Total including VAT, in naira. */
	total: number;
	status: QuoteStatus;
	createdBy: string;
	/** ISO date, for sorting. */
	validUntil: string;
	validUntilLabel: string;
	/** "v1", "v2 · 1 earlier version". */
	version: string;
};

export type QuoteLine = { name: string; desc: string; qty: number; unit: number };

export type QuoteVersion = {
	n: number;
	/** Sent line, e.g. "Sent 6 Nov, 10:42 by Emeka Obi". */
	sentLine: string;
	lines: QuoteLine[];
	/** What changed from the version before, for every version but the first. */
	changes?: { tag: string; tone: BadgeVariant; text: string; amount: string }[];
	changeNote?: string;
};

export type QuoteContact = { email: string; whatsapp: string; phone: string; phoneLabel: string };

export type QuoteDetail = {
	quote: Quote;
	contact: QuoteContact;
	/** Newest first. */
	versions: QuoteVersion[];
	activity: { when: string; what: string; detail: string }[];
	/** The deposit that confirms the order, as a share of the total. */
	depositRate: number;
	validityLine: string;
};

export const VAT_RATE = 0.075;
export const subtotal = (lines: QuoteLine[]) => lines.reduce((sum, l) => sum + l.qty * l.unit, 0);

const q = (
	id: string,
	client: string,
	items: string,
	total: number,
	status: QuoteStatus,
	createdBy: string,
	validUntil: string,
	validUntilLabel: string,
	version = "v1",
): Quote => ({ id, client, items, total, status, createdBy, validUntil, validUntilLabel, version });

/**
 * TODO: replace with real quotes once there's a backend.
 * The sample quotes from the design, newest first. The pages only read quotes
 * through here, so swapping in real data is a one-file change.
 */
const QUOTES: Quote[] = [
	q(
		"MAJ-QT-20261107-1432",
		"Adaeze Okafor",
		"3-seater sofa, coffee table",
		1644170.5,
		"draft",
		"Chiamaka Eze",
		"2026-11-14",
		"14 Nov 2026",
	),
	q(
		"MAJ-QT-20261106-1015",
		"Tunde Bakare",
		"Dining table, 6 chairs",
		2418750,
		"sent",
		"Emeka Obi",
		"2026-11-13",
		"13 Nov 2026",
		"v2 · 1 earlier version",
	),
	q(
		"MAJ-QT-20261105-1300",
		"Fatima Bello",
		"3-door wardrobe",
		964250,
		"sent",
		"Chiamaka Eze",
		"2026-11-12",
		"12 Nov 2026",
	),
	q(
		"MAJ-QT-20261104-1620",
		"Harbourview Suites",
		"Lobby lounge chairs × 12",
		8940000,
		"paid",
		"Emeka Obi",
		"2026-11-11",
		"11 Nov 2026",
	),
	q(
		"MAJ-QT-20261101-0930",
		"Ngozi Adeyemi",
		"King bed frame, 2 nightstands",
		1085600,
		"expiring",
		"Chiamaka Eze",
		"2026-11-08",
		"8 Nov 2026",
	),
	q(
		"MAJ-QT-20261028-1145",
		"Kola Martins",
		"Office desks × 4",
		1672000,
		"expired",
		"Emeka Obi",
		"2026-11-04",
		"4 Nov 2026",
	),
];

const CONTACTS: Record<string, QuoteContact> = {
	"Tunde Bakare": {
		email: "tunde.bakare@outlook.com",
		whatsapp: "2348023147760",
		phone: "+2348023147760",
		phoneLabel: "+234 802 314 7760",
	},
	"Ngozi Adeyemi": {
		email: "ngozi.adeyemi@yahoo.com",
		whatsapp: "2348091234455",
		phone: "+2348091234455",
		phoneLabel: "+234 809 123 4455",
	},
	"Adaeze Okafor": {
		email: "adaeze.okafor@gmail.com",
		whatsapp: "2348035550142",
		phone: "+2348035550142",
		phoneLabel: "+234 803 555 0142",
	},
	"Fatima Bello": {
		email: "",
		whatsapp: "2348053307781",
		phone: "+2348053307781",
		phoneLabel: "+234 805 330 7781",
	},
};
const NO_CONTACT: QuoteContact = { email: "", whatsapp: "", phone: "", phoneLabel: "" };

const TUNDE_V1: QuoteLine[] = [
	{ name: "Dining table", desc: "Solid walnut, 220 × 100 cm, seats 8", qty: 1, unit: 1026000 },
	{
		name: "Dining chair",
		desc: "Walnut frame, woven paper cord seat (black)",
		qty: 6,
		unit: 204000,
	},
	{
		name: "Carver armchair",
		desc: "Walnut frame with arms, woven cord seat",
		qty: 2,
		unit: 310000,
	},
];
const TUNDE_V2: QuoteLine[] = [
	TUNDE_V1[0],
	{
		name: "Dining chair",
		desc: "Walnut frame, woven paper cord seat (natural)",
		qty: 6,
		unit: 204000,
	},
];

export async function getQuotes(): Promise<Quote[]> {
	return QUOTES;
}

export async function getQuoteDetail(id: string): Promise<QuoteDetail | null> {
	const quote = QUOTES.find((x) => x.id === id);
	if (!quote) return null;
	const contact = CONTACTS[quote.client] ?? NO_CONTACT;
	const base = { quote, contact, depositRate: 0.7 };

	if (id === "MAJ-QT-20261106-1015") {
		return {
			...base,
			validityLine: "Sent 6 Nov 2026 · Valid until 13 Nov 2026",
			versions: [
				{
					n: 2,
					sentLine: "Sent 6 Nov, 10:42 by Emeka Obi",
					lines: TUNDE_V2,
					changeNote: "Requested by the client on WhatsApp, 6 Nov · noted by Emeka Obi.",
					changes: [
						{
							tag: "Removed",
							tone: "danger",
							text: "Carver armchair × 2",
							amount: "− ₦620,000.00",
						},
						{
							tag: "Changed",
							tone: "info",
							text: "Dining chair: woven cord colour black → natural",
							amount: "₦0.00",
						},
						{
							tag: "Total",
							tone: "neutral",
							text: "₦3,085,250.00 → ₦2,418,750.00",
							amount: "− ₦666,500.00",
						},
					],
				},
				{ n: 1, sentLine: "Sent 5 Nov, 16:20 by Emeka Obi", lines: TUNDE_V1 },
			],
			activity: [
				{
					when: "5 Nov 2026, 16:05",
					what: "Quote created (v1)",
					detail: "by Emeka Obi (Sales)",
				},
				{
					when: "5 Nov 2026, 16:20",
					what: "v1 sent",
					detail: "to tunde.bakare@outlook.com",
				},
				{
					when: "6 Nov 2026, 10:30",
					what: "v2 created",
					detail: "by Emeka Obi: removed carver armchairs, cord colour changed",
				},
				{ when: "6 Nov 2026, 10:42", what: "v2 sent", detail: "v1 marked superseded" },
			],
		};
	}

	// The other sample quotes have no itemised version in the design: show the quote as one line.
	return {
		...base,
		validityLine: `${quote.status === "draft" ? "Draft" : "Sent"} · Valid until ${quote.validUntilLabel}`,
		versions: [
			{
				n: 1,
				sentLine: `By ${quote.createdBy}`,
				lines: [
					{
						name: quote.items,
						desc: "Itemised lines appear here once the quote builder is connected.",
						qty: 1,
						unit: quote.total / (1 + VAT_RATE),
					},
				],
			},
		],
		activity: [{ when: "—", what: "Quote created (v1)", detail: `by ${quote.createdBy}` }],
	};
}

export const sampleQuoteIds = QUOTES.map((x) => x.id);
