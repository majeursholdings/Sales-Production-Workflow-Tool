import dayjs from "dayjs";
import { getInvoices } from "@/lib/data/invoices";
import { CATEGORY_LABELS, type FinanceCategory, type FinanceEntry } from "@/lib/finance";
import { balanceOf } from "@/lib/invoices";
import { createClient } from "@/utils/supabase/server";

export type OwedToday = {
	toMajeurs: { amount: number; invoices: number };
	toSuppliers: { amount: number; purchaseOrders: number };
};

export type FinanceData = {
	/** YYYY-MM-DD, so the server and the browser agree on what "today" is. */
	today: string;
	/** Every entry, newest first. */
	entries: FinanceEntry[];
	owed: OwedToday;
};

type ExpenseRow = {
	id: string;
	paid_on: string;
	category: FinanceCategory;
	amount: number | string;
	paid_to: string;
	reference: string;
	recorded_by_name: string;
};

type OrderRow = {
	number: string;
	order_date: string;
	delivered_on: string | null;
	status: string;
	raised_by: string;
	suppliers: { business: string } | null;
	purchase_order_lines: {
		ordered: number | string;
		received: number | string;
		unit_cost: number | string;
	}[];
};

const PAYMENT_TEXT = {
	deposit: "Deposit from",
	balance: "Balance payment from",
	part: "Part payment from",
} as const;

/**
 * The ledger behind Revenue & expenses, built from real money movements:
 * - money in: every payment recorded on an invoice (deposits, balances, part payments);
 * - money out: expenses recorded by hand, plus materials received on purchase orders
 *   (received quantity × unit cost, dated the day the delivery was recorded).
 */
export async function getFinanceData(): Promise<FinanceData> {
	const supabase = await createClient();
	const [invoices, expensesResult, ordersResult] = await Promise.all([
		getInvoices(),
		supabase
			.from("expenses")
			.select("id, paid_on, category, amount, paid_to, reference, recorded_by_name")
			.order("paid_on", { ascending: false }),
		supabase
			.from("purchase_orders")
			.select(
				"number, order_date, delivered_on, status, raised_by, suppliers(business), purchase_order_lines(ordered, received, unit_cost)",
			)
			.in("status", ["approval", "sent", "part", "received"]),
	]);
	if (expensesResult.error) {
		throw new Error(`Failed to load expenses: ${expensesResult.error.message}`);
	}
	if (ordersResult.error) {
		throw new Error(`Failed to load purchase orders: ${ordersResult.error.message}`);
	}
	const expenses = (expensesResult.data ?? []) as ExpenseRow[];
	const orders = (ordersResult.data ?? []) as unknown as OrderRow[];

	const income: FinanceEntry[] = invoices.flatMap((invoice) =>
		invoice.payments.map((p) => ({
			id: `pay-${p.id}`,
			date: p.date,
			kind: "in" as const,
			category: p.kind === "deposit" ? ("dep" as const) : ("bal" as const),
			amount: p.amount,
			description: `${PAYMENT_TEXT[p.kind]} ${invoice.client}`,
			reference: p.reference ? `${invoice.id} · ref ${p.reference}` : invoice.id,
			recordedBy: p.recordedBy,
			href: `/invoices/${invoice.id}`,
		})),
	);

	const running: FinanceEntry[] = expenses.map((e) => ({
		id: `exp-${e.id}`,
		date: e.paid_on,
		kind: "out",
		category: e.category,
		amount: Number(e.amount),
		description: `${CATEGORY_LABELS[e.category]}: ${e.paid_to}`,
		reference: e.reference,
		recordedBy: e.recorded_by_name || "Staff",
	}));

	const sum = (lines: OrderRow["purchase_order_lines"], qty: "received" | "outstanding") =>
		lines.reduce((total, l) => {
			const received = Number(l.received);
			const count = qty === "received" ? received : Math.max(0, Number(l.ordered) - received);
			return total + count * Number(l.unit_cost);
		}, 0);

	const materials: FinanceEntry[] = orders.flatMap((po) => {
		const amount = sum(po.purchase_order_lines ?? [], "received");
		if (amount <= 0) return [];
		return [
			{
				id: `po-${po.number}`,
				date: po.delivered_on ?? po.order_date,
				kind: "out" as const,
				category: "mat" as const,
				amount,
				description: `Materials from ${po.suppliers?.business ?? "supplier"}`,
				reference: po.number,
				recordedBy: po.raised_by,
				href: "/purchase-orders",
			},
		];
	});

	const partPaid = invoices.filter((i) => balanceOf(i) > 0);
	const openOrders = orders.filter((po) => po.status !== "received");

	return {
		today: dayjs().format("YYYY-MM-DD"),
		entries: [...income, ...running, ...materials].sort((a, b) => b.date.localeCompare(a.date)),
		owed: {
			toMajeurs: {
				amount: partPaid.reduce((total, i) => total + balanceOf(i), 0),
				invoices: partPaid.length,
			},
			toSuppliers: {
				amount: openOrders.reduce(
					(total, po) => total + sum(po.purchase_order_lines ?? [], "outstanding"),
					0,
				),
				purchaseOrders: openOrders.length,
			},
		},
	};
}
