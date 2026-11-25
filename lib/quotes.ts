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
	/** The quote number, e.g. MAJ-QT-YYYYMMDD-HHmm. It is also what the URL uses. */
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
	/** Sent line, e.g. "Sent 6 Nov, 10:42 by <name>". */
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
	/** The VAT rate the quote was priced with. */
	vatRate: number;
	validityLine: string;
};

export const VAT_RATE = 0.075;
export const subtotal = (lines: QuoteLine[]) => lines.reduce((sum, l) => sum + l.qty * l.unit, 0);
