import dayjs from "dayjs";
import type { BadgeVariant } from "@/components/common/badge";
import type { OverviewItem } from "@/components/common/overViewCard";
import { formatNaira } from "@/lib/currency";
import type { QuoteLine } from "@/lib/quotes";

export type InvoiceStatus = "part" | "paid";

export const INVOICE_STATUS: Record<InvoiceStatus, { label: string; tone: BadgeVariant }> = {
	part: { label: "Part paid", tone: "warning" },
	paid: { label: "Paid", tone: "success" },
};

export type PaymentKind = "deposit" | "balance" | "part";

export type InvoicePayment = {
	id: string;
	kind: PaymentKind;
	label: string;
	/** ISO date the money landed. */
	date: string;
	recordedBy: string;
	amount: number;
	reference: string;
};

/** "Deposit (70%)", "Balance" or "Part payment". */
export function paymentLabel(kind: PaymentKind, depositRate: number) {
	if (kind === "deposit") return `Deposit (${Math.round(depositRate * 100)}%)`;
	return kind === "balance" ? "Balance" : "Part payment";
}

export type Invoice = {
	/** The invoice number, e.g. MAJ-INV-YYYYMMDD-HHmm. It is also what the URL uses. */
	id: string;
	/** ISO timestamp, for sorting. */
	issuedAt: string;
	client: string;
	quoteNumber: string;
	quoteVersion: number;
	/** Total including VAT, in naira. */
	total: number;
	/** Oldest first. */
	payments: InvoicePayment[];
	createdBy: string;
	createdByRole: string;
};

export type InvoiceDetail = {
	invoice: Invoice;
	billTo: { name: string; address: string; email: string };
	lines: QuoteLine[];
	subtotal: number;
	vatRate: number;
	quotePreparedBy: string;
	/** Share of the total taken as the deposit. */
	depositRate: number;
};

export const paidOf = (invoice: Invoice) => invoice.payments.reduce((sum, p) => sum + p.amount, 0);
/** What's still owed, to the kobo (so sums of payments never leave a stray fraction). */
export const balanceOf = (invoice: Invoice) =>
	Math.max(0, Math.round((invoice.total - paidOf(invoice)) * 100) / 100);
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
