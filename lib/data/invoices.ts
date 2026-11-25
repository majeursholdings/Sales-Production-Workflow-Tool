import {
	paymentLabel,
	type Invoice,
	type InvoiceDetail,
	type InvoicePayment,
	type PaymentKind,
} from "@/lib/invoices";
import { createClient } from "@/utils/supabase/server";

const INVOICE_COLUMNS =
	"number, issued_at, bill_to_name, quote_number, quote_version, total, deposit_rate, created_by_name, created_by_role, invoice_payments(id, kind, amount, paid_on, reference, recorded_by_name, created_at)";

type PaymentRow = {
	id: string;
	kind: PaymentKind;
	amount: number | string;
	paid_on: string;
	reference: string;
	recorded_by_name: string;
	created_at: string;
};

type InvoiceRowDb = {
	number: string;
	issued_at: string;
	bill_to_name: string;
	quote_number: string;
	quote_version: number;
	total: number | string;
	deposit_rate: number | string;
	created_by_name: string;
	created_by_role: string;
	invoice_payments: PaymentRow[] | null;
};

const toPayment = (row: PaymentRow, depositRate: number): InvoicePayment => ({
	id: row.id,
	kind: row.kind,
	label: paymentLabel(row.kind, depositRate),
	date: row.paid_on,
	recordedBy: row.recorded_by_name || "Staff",
	amount: Number(row.amount),
	reference: row.reference,
});

const toInvoice = (row: InvoiceRowDb): Invoice => {
	const depositRate = Number(row.deposit_rate);
	return {
		id: row.number,
		issuedAt: row.issued_at,
		client: row.bill_to_name,
		quoteNumber: row.quote_number,
		quoteVersion: Number(row.quote_version),
		total: Number(row.total),
		payments: [...(row.invoice_payments ?? [])]
			.sort(
				(a, b) =>
					a.paid_on.localeCompare(b.paid_on) || a.created_at.localeCompare(b.created_at),
			)
			.map((p) => toPayment(p, depositRate)),
		createdBy: row.created_by_name || "Staff",
		createdByRole: row.created_by_role,
	};
};

/** Every invoice with its payments, newest first. */
export async function getInvoices(): Promise<Invoice[]> {
	const supabase = await createClient();
	const { data, error } = await supabase
		.from("invoices")
		.select(INVOICE_COLUMNS)
		.order("issued_at", { ascending: false });
	if (error) throw new Error(`Failed to load invoices: ${error.message}`);
	return ((data ?? []) as InvoiceRowDb[]).map(toInvoice);
}

export async function getInvoiceDetail(number: string): Promise<InvoiceDetail | null> {
	const supabase = await createClient();
	const { data, error } = await supabase
		.from("invoices")
		.select(
			`${INVOICE_COLUMNS}, bill_to_address, bill_to_email, vat_rate, subtotal, quotes(created_by_name), invoice_lines(name, description, quantity, unit_price, sort_order)`,
		)
		.eq("number", number)
		.maybeSingle();
	if (error) throw new Error(`Failed to load invoice ${number}: ${error.message}`);
	if (!data) return null;

	const row = data as unknown as InvoiceRowDb & {
		bill_to_address: string;
		bill_to_email: string;
		vat_rate: number | string;
		subtotal: number | string;
		quotes: { created_by_name: string } | null;
		invoice_lines:
			| {
					name: string;
					description: string;
					quantity: number | string;
					unit_price: number | string;
					sort_order: number;
			  }[]
			| null;
	};

	return {
		invoice: toInvoice(row),
		billTo: { name: row.bill_to_name, address: row.bill_to_address, email: row.bill_to_email },
		lines: [...(row.invoice_lines ?? [])]
			.sort((a, b) => a.sort_order - b.sort_order)
			.map((l) => ({
				name: l.name,
				desc: l.description,
				qty: Number(l.quantity),
				unit: Number(l.unit_price),
			})),
		subtotal: Number(row.subtotal),
		vatRate: Number(row.vat_rate),
		quotePreparedBy: row.quotes?.created_by_name ?? "",
		depositRate: Number(row.deposit_rate),
	};
}
