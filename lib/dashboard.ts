import dayjs from "dayjs";
import type { BadgeVariant } from "@/components/common/badge";
import type { OverviewItem } from "@/components/common/overViewCard";
import { formatNaira } from "@/lib/currency";
import { getCostRequests } from "@/lib/data/costRequests";
import { getInvoices } from "@/lib/data/invoices";
import { getJobCards } from "@/lib/data/jobCards";
import { getInventory, getPurchaseOrders } from "@/lib/data/procurement";
import { ageLabel } from "@/lib/costRequests";
import { balanceOf, statusOf as invoiceStatusOf } from "@/lib/invoices";
import { cardFigures, dueNote, stepLabel } from "@/lib/jobCards";
import { shortfallsOf, stockFlag } from "@/lib/inventory";
import { poTotal } from "@/lib/purchaseOrders";
import { QUOTE_STATUS, type QuoteStatus } from "@/lib/quotes";
import type { AppRole } from "@/lib/roles";
import { createClient } from "@/utils/supabase/server";

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
	/** Today, e.g. "Wednesday, 25 November 2026". */
	dateLabel: string;
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

type View = "md" | "care" | "sales" | "acct" | "proc" | "prod";

const VIEW_OF: Record<AppRole, View> = {
	md: "md",
	gm: "md",
	accounting: "acct",
	procurement: "proc",
	production: "prod",
	sales: "sales",
	customer_care: "care",
};

const SCOPE: Record<View, string> = {
	md: "All teams",
	care: "Your quotes and clients",
	proc: "Stock, costs and purchase orders",
	sales: "Your quotes and clients",
	acct: "Payments and rates",
	prod: "Workshop and deliveries",
};

type DashQuote = {
	number: string;
	client: string;
	items: string;
	total: number;
	depositRate: number;
	status: QuoteStatus;
	createdBy: string | null;
	createdByName: string;
	createdAt: string;
	validUntil: string;
	email: string;
	phone: string;
	phoneKey: string;
};

async function getDashQuotes(): Promise<DashQuote[]> {
	const supabase = await createClient();
	const { data, error } = await supabase
		.from("quotes")
		.select(
			"quote_number, client_name, items_summary, total_ngn, deposit_rate, status, created_by, created_by_name, created_at, valid_until, clients(email, phone, phone_key)",
		)
		.order("created_at", { ascending: false });
	if (error) throw new Error(`Failed to load quotes: ${error.message}`);

	return (data ?? []).map((row) => {
		const client = (Array.isArray(row.clients) ? row.clients[0] : row.clients) as {
			email: string | null;
			phone: string | null;
			phone_key: string | null;
		} | null;
		return {
			number: row.quote_number,
			client: row.client_name,
			items: row.items_summary ?? "",
			total: Number(row.total_ngn),
			depositRate: Number(row.deposit_rate),
			status: row.status as QuoteStatus,
			createdBy: row.created_by,
			createdByName: row.created_by_name || "Staff",
			createdAt: row.created_at,
			validUntil: row.valid_until,
			email: client?.email ?? "",
			phone: client?.phone ?? "",
			phoneKey: client?.phone_key ?? "",
		};
	});
}

async function getFeed(): Promise<FeedItem[]> {
	const supabase = await createClient();
	const { data } = await supabase
		.from("quote_activity")
		.select("actor_id, what, detail, created_at, quotes(client_name)")
		.order("created_at", { ascending: false })
		.limit(8);
	const rows = data ?? [];
	const ids = [...new Set(rows.map((r) => r.actor_id).filter(Boolean))];
	const { data: people } = ids.length
		? await supabase.from("profiles").select("id, full_name").in("id", ids)
		: { data: [] };
	const nameOf = new Map((people ?? []).map((p) => [p.id, p.full_name as string]));

	return rows.map((r) => {
		const name = nameOf.get(r.actor_id) ?? "Someone";
		const quote = (Array.isArray(r.quotes) ? r.quotes[0] : r.quotes) as {
			client_name: string;
		} | null;
		return {
			who: initialsOf(name),
			text: `${name}: ${r.what}${quote ? ` for ${quote.client_name}` : ""}`,
			when: dayjs(r.created_at).format("D MMM, HH:mm"),
		};
	});
}

const initialsOf = (name: string) =>
	name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((w) => w[0]?.toUpperCase())
		.join("") || "?";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const isOpen = (q: DashQuote) => q.status === "sent" || q.status === "expiring";
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const listNames = (qs: DashQuote[]) =>
	qs
		.slice(0, 2)
		.map((q) => q.client)
		.join(", ") + (qs.length > 2 ? ` +${qs.length - 2}` : "");

function expiryLabel(validUntil: string, today: dayjs.Dayjs) {
	const days = dayjs(validUntil).diff(today, "day");
	return days <= 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
}

function followUpItem(q: DashQuote, today: dayjs.Dayjs): AttentionItem {
	const when = expiryLabel(q.validUntil, today);
	return {
		id: `expiring-${q.number}`,
		tag: "Expiring",
		tone: "warning",
		title: `${q.client}: quote expires ${when}`,
		detail: `${q.items || q.number} · ${formatNaira(q.total)} · created by ${q.createdByName}`,
		cta: "Follow up",
		href: `/quotes/${q.number}`,
		followUp: {
			client: q.client,
			email: q.email,
			whatsapp: q.phoneKey.replace(/\D/g, ""),
			phone: q.phoneKey || q.phone,
			subject: `Your Majeurs quote ${q.number}`,
			message: `Hello ${q.client.split(" ")[0]}, a quick reminder that your quote ${q.number} expires ${when}. Let us know if you have any questions.`,
		},
	};
}

export async function getDashboard(user: { id: string; roleKey: AppRole }): Promise<DashboardData> {
	const view = VIEW_OF[user.roleKey];
	const today = dayjs().startOf("day");
	const iso = today.format("YYYY-MM-DD");
	const [quotes, inventory, orders, feed, jobCards, invoices, requests] = await Promise.all([
		getDashQuotes(),
		getInventory(),
		getPurchaseOrders(),
		getFeed(),
		getJobCards(),
		getInvoices(),
		getCostRequests(),
	]);

	// Workshop
	const activeCards = jobCards
		.filter((c) => !c.closed)
		.sort((a, b) => a.due.localeCompare(b.due));
	const stageOf = (c: (typeof jobCards)[number]) => stepLabel(c, cardFigures(c).current);
	const waitingOnParts = activeCards.filter((c) => c.steps.some((st) => st.status === "blocked"));
	const dueThisWeek = activeCards.filter((c) => dayjs(c.due).diff(today, "day") <= 7);
	const readyCards = activeCards.filter((c) => cardFigures(c).current === null);
	const production: ProductionRow[] = activeCards.slice(0, 8).map((c) => ({
		id: c.id,
		href: `/work-orders/${c.id}`,
		client: c.client,
		items: c.items,
		stage: stageOf(c),
		due: dueNote(c, iso).text,
	}));

	// Money owed and requests waiting
	const partPaid = invoices.filter((inv) => invoiceStatusOf(inv) === "part");
	const openRequests = requests
		.filter((r) => r.status === "open")
		.sort((a, b) => a.requestedAt.localeCompare(b.requestedAt));

	// Quotes: sales and customer care see their own, everyone else sees all
	const mine = view === "sales" || view === "care";
	const scoped = mine ? quotes.filter((q) => q.createdBy === user.id) : quotes;
	const last30 = scoped.filter((q) => dayjs(q.createdAt).isAfter(today.subtract(30, "day")));
	const open = scoped.filter(isOpen);
	const drafts = scoped.filter((q) => q.status === "draft");
	const paid = scoped.filter((q) => q.status === "paid");
	const expiringSoon = open
		.filter((q) => dayjs(q.validUntil).diff(today, "day") <= 7)
		.sort((a, b) => a.validUntil.localeCompare(b.validUntil));
	const depositOf = (q: DashQuote) => q.total * q.depositRate;

	// Stock and orders
	const lowStock = inventory.parts.filter((p) => stockFlag(p) !== null);
	const shortfalls = shortfallsOf(inventory);
	const awaitingApproval = orders.filter((po) => po.status === "approval");
	const incoming = orders
		.filter((po) => (po.status === "sent" || po.status === "part") && po.expected)
		.sort((a, b) => a.expected!.localeCompare(b.expected!));
	const receivedThisMonth = orders.filter(
		(po) => po.deliveredOn && dayjs(po.deliveredOn).isSame(today, "month"),
	);

	const expiringCard: OverviewItem = {
		label: "Expiring this week",
		value: String(expiringSoon.length),
		note: expiringSoon[0]
			? `${expiringSoon[0].client}, ${expiryLabel(expiringSoon[0].validUntil, today)}`
			: "Nothing expiring",
		...(expiringSoon.length > 0 && { tone: "warning" as const }),
	};
	const awaitingDepositCard: OverviewItem = {
		label: "Awaiting deposit",
		value: formatNaira(sum(open.map(depositOf))),
		note: open.length ? `From ${plural(open.length, "sent quote")}` : "No quotes sent",
	};

	const overview: Record<View, () => OverviewItem[]> = {
		md: () => [
			{
				label: "Quoted, last 30 days",
				value: formatNaira(sum(last30.map((q) => q.total))),
				note: plural(last30.length, "quote"),
			},
			{
				label: "Deposits recorded",
				value: formatNaira(sum(paid.map(depositOf))),
				note: plural(paid.length, "order confirmed", "orders confirmed"),
			},
			awaitingDepositCard,
			expiringCard,
		],
		care: () => [
			{
				label: "My open quotes",
				value: String(open.length + drafts.length),
				note: `${formatNaira(sum([...open, ...drafts].map((q) => q.total)))} in total`,
			},
			{
				label: "Awaiting deposit",
				value: String(open.length),
				note: open.length ? listNames(open) : "None waiting",
			},
			{
				label: "Drafts",
				value: String(drafts.length),
				note: drafts.length ? listNames(drafts) : "No drafts",
			},
			expiringCard,
		],
		sales: () => overview.care(),
		acct: () => [
			{
				label: "Deposits recorded",
				value: formatNaira(sum(paid.map(depositOf))),
				note: plural(paid.length, "deposit"),
			},
			awaitingDepositCard,
			{
				label: "Supplier deliveries this month",
				value: formatNaira(
					sum(
						receivedThisMonth.map((po) =>
							sum(po.lines.map((l) => l.received * l.unitCost)),
						),
					),
				),
				note: plural(receivedThisMonth.length, "order"),
			},
			{
				label: "Balances outstanding",
				value: formatNaira(sum(partPaid.map(balanceOf))),
				note: plural(partPaid.length, "invoice part paid", "invoices part paid"),
			},
		],
		proc: () => [
			{
				label: "Cost requests",
				value: String(openRequests.length),
				note: openRequests[0]
					? `Oldest: ${ageLabel(openRequests[0].requestedAt, dayjs().toISOString())}`
					: "None waiting",
			},
			{
				label: "Short for orders",
				value: plural(new Set(shortfalls.map((s) => s.sku)).size, "part"),
				note: shortfalls[0] ? shortfalls[0].jobCard : "Nothing short",
				...(shortfalls.length > 0 && { tone: "danger" as const }),
			},
			{
				label: "Low stock",
				value: plural(lowStock.length, "part"),
				note: "At or below reorder level",
				...(lowStock.length > 0 && { tone: "warning" as const }),
			},
			{
				label: "Deliveries expected",
				value: String(incoming.length),
				note: incoming[0]
					? `Next: ${dayjs(incoming[0].expected).format("D MMM")}`
					: "Nothing on order",
			},
		],
		prod: () => [
			{
				label: "Active job cards",
				value: String(activeCards.length),
				note: waitingOnParts.length
					? `${waitingOnParts.length} waiting on parts`
					: "None waiting on parts",
			},
			{
				label: "Due in 7 days",
				value: String(dueThisWeek.length),
				note: dueThisWeek[0]
					? `${dueThisWeek[0].client}, ${dayjs(dueThisWeek[0].due).format("D MMM")}`
					: "Nothing due",
				...(dueThisWeek.length > 0 && { tone: "warning" as const }),
			},
			{
				label: "Parts short",
				value: plural(new Set(shortfalls.map((s) => s.sku)).size, "part"),
				note: shortfalls.length ? "For confirmed job cards" : "Nothing short",
				...(shortfalls.length > 0 && { tone: "danger" as const }),
			},
			{
				label: "Ready for delivery",
				value: String(readyCards.length),
				note: readyCards[0] ? readyCards[0].client : "None ready",
			},
		],
	};

	// Things to act on, most urgent first
	const attention: AttentionItem[] = [];
	if (view === "md") {
		for (const po of awaitingApproval) {
			attention.push({
				id: `approve-${po.number}`,
				tag: "Approve",
				tone: "danger",
				title: `${po.number} needs your approval`,
				detail: `${po.supplierName} · ${formatNaira(poTotal(po))} · raised by ${po.raisedBy}`,
				cta: "Review order",
				href: "/purchase-orders",
			});
		}
	}
	if (view !== "proc" && view !== "prod") {
		attention.push(...expiringSoon.slice(0, 5).map((q) => followUpItem(q, today)));
	}
	if (view === "care" || view === "sales") {
		for (const q of drafts.slice(0, 3)) {
			attention.push({
				id: `draft-${q.number}`,
				tag: "Draft",
				tone: "neutral",
				title: `${q.client}: draft not sent yet`,
				detail: `${q.items || q.number} · ${formatNaira(q.total)}`,
				cta: "Open quote",
				href: `/quotes/${q.number}`,
			});
		}
	}
	if (view === "md" || view === "proc" || view === "prod") {
		if (shortfalls.length) {
			attention.push({
				id: "short",
				tag: "Short",
				tone: "danger",
				title: `${plural(new Set(shortfalls.map((s) => s.sku)).size, "part")} short for confirmed orders`,
				detail: [...new Set(shortfalls.map((s) => s.jobCard))].join(", "),
				cta: "View shortfall",
				href: "/inventory",
			});
		}
		if (lowStock.length && view !== "prod") {
			attention.push({
				id: "low",
				tag: "Low stock",
				tone: "warning",
				title: `${plural(lowStock.length, "part")} at or below reorder level`,
				detail: lowStock
					.slice(0, 3)
					.map((p) => p.name)
					.join(", "),
				cta: "Raise orders",
				href: "/inventory",
			});
		}
	}

	if (view === "md" || view === "proc") {
		for (const r of openRequests.slice(0, 3)) {
			attention.push({
				id: `request-${r.id}`,
				tag: "Cost request",
				tone: "info",
				title: `${r.id}: ${r.client || "custom design"} needs costing`,
				detail: `Requested by ${r.requestedBy} · ${ageLabel(r.requestedAt, dayjs().toISOString())}`,
				cta: "Review",
				href: "/cost-requests",
			});
		}
	}
	if (view === "md" || view === "prod") {
		for (const c of activeCards.filter((c) => dueNote(c, iso).urgent).slice(0, 3)) {
			attention.push({
				id: `due-${c.id}`,
				tag: stageOf(c).label === "Waiting on parts" ? "Blocked" : "Due",
				tone: dayjs(c.due).isBefore(today) ? "danger" : "warning",
				title: `${c.id} (${c.client}): ${dueNote(c, iso).text.toLowerCase()}`,
				detail: `${c.items} · ${stageOf(c).label}`,
				cta: "Open job card",
				href: `/work-orders/${c.id}`,
			});
		}
	}
	if (view === "acct" || view === "md") {
		for (const inv of partPaid.slice(0, 3)) {
			attention.push({
				id: `balance-${inv.id}`,
				tag: "Balance",
				tone: "info",
				title: `${inv.client}: ${formatNaira(balanceOf(inv))} balance due`,
				detail: inv.id,
				cta: "Open invoice",
				href: `/invoices/${inv.id}`,
			});
		}
	}

	const pipeline: PipelineRow[] = (["draft", "sent", "expiring", "paid", "expired"] as const)
		.map((status) => ({
			label: QUOTE_STATUS[status].label,
			tone: QUOTE_STATUS[status].tone,
			amount: sum(last30.filter((q) => q.status === status).map((q) => q.total)),
		}))
		.filter((r) => r.amount > 0);

	const deliveries: DeliveryItem[] = incoming.slice(0, 5).map((po) => ({
		date: dayjs(po.expected).format("D MMM"),
		tone: dayjs(po.expected).isBefore(today) ? "danger" : "info",
		client: po.supplierName,
		detail: `${po.number} · ${po.lines.map((l) => l.name).join(", ")}`,
	}));

	return {
		dateLabel: today.format("dddd, D MMMM YYYY"),
		scope: SCOPE[view],
		overview: overview[view](),
		attention,
		production: view === "care" || view === "sales" ? undefined : production,
		deliveries: view === "prod" || view === "proc" ? deliveries : undefined,
		pipeline: view === "prod" || view === "proc" ? undefined : pipeline,
		feed,
	};
}
