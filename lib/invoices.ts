import dayjs from "dayjs";
import type { BadgeVariant } from "@/components/common/badge";
import type { OverviewItem } from "@/components/common/overViewCard";
import { formatNaira } from "@/lib/currency";
import { VAT_RATE, type QuoteLine } from "@/lib/quotes";

export type InvoiceStatus = "part" | "paid";

export const INVOICE_STATUS: Record<InvoiceStatus, { label: string; tone: BadgeVariant }> = {
	part: { label: "Part paid", tone: "warning" },
	paid: { label: "Paid", tone: "success" },
};

export type InvoicePayment = {
	label: string;
	/** ISO date the money landed. */
	date: string;
	recordedBy: string;
	amount: number;
};

export type Invoice = {
	/** The invoice number, e.g. MAJ-INV-20261107-1750. It is also what the URL uses. */
	id: string;
	/** ISO timestamp, for sorting. */
	issuedAt: string;
	client: string;
	quoteNumber: string;
	quoteVersion: number;
	/** Total including VAT, in naira. */
	total: number;
	payments: InvoicePayment[];
	createdBy: string;
	createdByRole: string;
};

export type InvoiceDetail = {
	invoice: Invoice;
	billTo: { name: string; address: string; email: string };
	lines: QuoteLine[];
	quotePreparedBy: string;
	/** Job card made when the deposit was recorded, if there is one. */
	jobCard?: string;
	lastSentLabel?: string;
	/** Share of the total taken as the deposit. */
	depositRate: number;
};

export const paidOf = (invoice: Invoice) => invoice.payments.reduce((sum, p) => sum + p.amount, 0);
export const balanceOf = (invoice: Invoice) => Math.max(0, invoice.total - paidOf(invoice));
export const statusOf = (invoice: Invoice): InvoiceStatus =>
	balanceOf(invoice) === 0 ? "paid" : "part";
export const issuedLabel = (invoice: Invoice) =>
	dayjs(invoice.issuedAt).format("D MMM YYYY, HH:mm");

/** A row in the invoices table: an invoice with its figures worked out, so the table can filter and sort on them. */
export type InvoiceRow = {
	id: string;
	client: string;
	quoteNumber: string;
	quoteVersion: number;
	issuedAt: string;
	issuedLabel: string;
	total: number;
	paid: number;
	balance: number;
	status: InvoiceStatus;
};

export const toInvoiceRow = (invoice: Invoice): InvoiceRow => ({
	id: invoice.id,
	client: invoice.client,
	quoteNumber: invoice.quoteNumber,
	quoteVersion: invoice.quoteVersion,
	issuedAt: invoice.issuedAt,
	issuedLabel: issuedLabel(invoice),
	total: invoice.total,
	paid: paidOf(invoice),
	balance: balanceOf(invoice),
	status: statusOf(invoice),
});

export function buildInvoicesOverview(invoices: Invoice[], today = dayjs()): OverviewItem[] {
	const part = invoices.filter((i) => statusOf(i) === "part");
	const since = today.subtract(30, "day");
	const collected = invoices
		.flatMap((i) => i.payments)
		.filter((p) => dayjs(p.date).isAfter(since))
		.reduce((sum, p) => sum + p.amount, 0);
	const paid = invoices.filter((i) => statusOf(i) === "paid").length;

	return [
		{
			label: "Balances outstanding",
			value: formatNaira(part.reduce((sum, i) => sum + balanceOf(i), 0)),
			note: `${part.length} ${part.length === 1 ? "invoice" : "invoices"} part paid`,
		},
		{
			label: "Collected, last 30 days",
			value: formatNaira(collected),
			note: "Deposits and balances",
		},
		{ label: "Paid in full", value: String(paid), note: "Ready for delivery" },
	];
}

// ── Sample data ──────────────────────────────────────────────────────────

const DEPOSIT_RATE = 0.7;

const pay = (label: string, date: string, recordedBy: string, amount: number): InvoicePayment => ({
	label,
	date,
	recordedBy,
	amount,
});

const inv = (
	id: string,
	issuedAt: string,
	client: string,
	quoteNumber: string,
	quoteVersion: number,
	total: number,
	payments: InvoicePayment[],
	createdBy: string,
	createdByRole: string,
): Invoice => ({
	id,
	issuedAt,
	client,
	quoteNumber,
	quoteVersion,
	total,
	payments,
	createdBy,
	createdByRole,
});

/**
 * TODO: replace with real invoices once there's a backend (an invoice is created when a deposit is recorded on a quote).
 * The sample invoices from the design, newest first. The pages only read invoices
 * through here, so swapping in real data is a one-file change.
 */
const INVOICES: Invoice[] = [
	inv(
		"MAJ-INV-20261107-1750",
		"2026-11-07T17:50:00",
		"Tunde Bakare",
		"MAJ-QT-20261106-1015",
		2,
		2418750,
		[pay("Deposit (70%)", "2026-11-07", "Bisi Lawal", 1693125)],
		"Bisi Lawal",
		"Accounting",
	),
	inv(
		"MAJ-INV-20261105-1120",
		"2026-11-05T11:20:00",
		"Harbourview Suites",
		"MAJ-QT-20261104-1620",
		1,
		8940000,
		[pay("Deposit (70%)", "2026-11-05", "Bisi Lawal", 6258000)],
		"Bisi Lawal",
		"Accounting",
	),
	inv(
		"MAJ-INV-20261030-0915",
		"2026-10-30T09:15:00",
		"Moyo & Okeke Interiors",
		"MAJ-QT-20261027-1610",
		3,
		3150000,
		[
			pay("Deposit (70%)", "2026-10-30", "Amaka Udeh", 2205000),
			pay("Balance (30%)", "2026-11-06", "Bisi Lawal", 945000),
		],
		"Amaka Udeh",
		"General Manager",
	),
	inv(
		"MAJ-INV-20261012-1430",
		"2026-10-12T14:30:00",
		"Moyo & Okeke Interiors",
		"MAJ-QT-20261009-1012",
		1,
		2480000,
		[
			pay("Deposit (70%)", "2026-10-12", "Bisi Lawal", 1736000),
			pay("Balance (30%)", "2026-10-24", "Bisi Lawal", 744000),
		],
		"Bisi Lawal",
		"Accounting",
	),
];

const TUNDE_LINES: QuoteLine[] = [
	{ name: "Dining table", desc: "Solid walnut, 220 × 100 cm, seats 8", qty: 1, unit: 1026000 },
	{ name: "Dining chair", desc: "Walnut frame, woven cord seat", qty: 6, unit: 204000 },
];

const BILL_TO: Record<string, { address: string; email: string }> = {
	"Tunde Bakare": {
		address: "7 Isaac John Street, GRA Ikeja, Lagos",
		email: "tunde.bakare@outlook.com",
	},
};

export async function getInvoices(): Promise<Invoice[]> {
	return INVOICES;
}

export async function getInvoiceDetail(id: string): Promise<InvoiceDetail | null> {
	const invoice = INVOICES.find((i) => i.id === id);
	if (!invoice) return null;

	const bill = BILL_TO[invoice.client] ?? { address: "", email: "" };
	const isTunde = invoice.id === "MAJ-INV-20261107-1750";

	return {
		invoice,
		billTo: { name: invoice.client, ...bill },
		// The other sample invoices have no itemised lines in the design: show the total as one line.
		lines: isTunde
			? TUNDE_LINES
			: [
					{
						name: "Items on the quote",
						desc: `As quoted on ${invoice.quoteNumber} v${invoice.quoteVersion}. Itemised lines appear here once invoices are connected to quotes.`,
						qty: 1,
						unit: invoice.total / (1 + VAT_RATE),
					},
				],
		quotePreparedBy: isTunde ? "Emeka Obi, Sales" : "",
		jobCard: isTunde ? "JC-20261107-0031" : undefined,
		lastSentLabel: isTunde ? "7 Nov 2026, 17:52" : undefined,
		depositRate: DEPOSIT_RATE,
	};
}

export const sampleInvoiceIds = INVOICES.map((i) => i.id);
