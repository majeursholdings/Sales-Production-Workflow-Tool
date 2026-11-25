import dayjs from "dayjs";
import type { BadgeVariant } from "@/components/common/badge";
import { PO_APPROVAL_LIMIT, shortfallsOf, type Inventory, type OrderGroup } from "@/lib/inventory";

// ─── Types ───────────────────────────────────────────────────────────────────

export type POStatus = "draft" | "approval" | "sent" | "part" | "received";

export type POLine = {
	sku: string;
	name: string;
	/** Singular unit, e.g. "slab". */
	unit: string;
	ordered: number;
	received: number;
	/** Naira per unit on this order. */
	unitCost: number;
};

export type DeliveryQuality = "As ordered" | "Minor issues" | "Rejected some";

export type PurchaseOrder = {
	/** MAJ-PO-YYYYMMDD-HHmm. */
	number: string;
	/** ISO date it was raised. */
	date: string;
	raisedBy: string;
	supplierId: string;
	lines: POLine[];
	status: POStatus;
	/** ISO date the supplier said it would arrive, or null before it's sent. */
	expected: string | null;
	/** ISO date of the last delivery recorded. */
	deliveredOn: string | null;
	/** How the last delivery arrived. */
	quality: DeliveryQuality | null;
	/** When approval was asked for, e.g. "2 Nov, 14:12". */
	approvalRequested: string | null;
	/** The job card it's for, or null for a restock. */
	jobCard: string | null;
	client: string | null;
	deliverTo: string;
	paymentTerms: string;
	/** Note to the supplier. */
	note: string;
};

// ─── Labels and figures ──────────────────────────────────────────────────────

export const PO_STATUS: Record<POStatus, { label: string; tone: BadgeVariant }> = {
	draft: { label: "Draft", tone: "neutral" },
	approval: { label: "Awaiting approval", tone: "warning" },
	sent: { label: "Sent", tone: "info" },
	part: { label: "Part received", tone: "warning" },
	received: { label: "Received", tone: "success" },
};

/** The status filter's groups. */
export const STATUS_GROUP: Record<POStatus, "draft" | "open" | "received"> = {
	draft: "draft",
	approval: "draft",
	sent: "open",
	part: "open",
	received: "received",
};

/** Who approves orders over PO_APPROVAL_LIMIT. */
export const APPROVERS = "Amaka Udeh (GM) or Femi Ogunleye (MD)";
export const APPROVERS_BOTH = "Amaka Udeh (GM) and Femi Ogunleye (MD)";

export const DELIVER_TO = ["Workshop, Ikeja", "Showroom"];
export const PAYMENT_TERMS = [
	"50% upfront, 50% on delivery",
	"Pay on delivery",
	"30 days after delivery",
];

export const poTotal = (po: Pick<PurchaseOrder, "lines">) =>
	po.lines.reduce((sum, l) => sum + l.ordered * l.unitCost, 0);

export const needsApproval = (total: number) => total > PO_APPROVAL_LIMIT;

/** ₦294,000.00 */
export const money = (n: number) =>
	`₦${n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const poDate = (iso: string) => dayjs(iso).format("D MMM YYYY");

/** "Walnut slab × 3 slabs, brass inlay strip × 40 metres" */
export const poItems = (po: Pick<PurchaseOrder, "lines">) =>
	po.lines
		.map((l, i) => {
			const name = i === 0 ? l.name : l.name.charAt(0).toLowerCase() + l.name.slice(1);
			return `${name} × ${unitQty(l.ordered, l.unit)}`;
		})
		.join(", ");

/** "3 slabs", "1 slab" */
export const unitQty = (n: number, unit: string) => `${n} ${n === 1 ? unit : `${unit}s`}`;

/** "Expected 10 Nov 2026", "Delivered 6 Nov 2026", "No delivery date yet". */
export function deliveryNote(po: PurchaseOrder) {
	if (po.status === "received" && po.deliveredOn) return `Delivered ${poDate(po.deliveredOn)}`;
	if (!po.expected) return "No delivery date yet";
	return `Expected ${poDate(po.expected)}`;
}

/** A new PO number from the time, unique among `taken`. */
export function poNumber(taken: Set<string>, now = dayjs()) {
	let t = now;
	let number = `MAJ-PO-${t.format("YYYYMMDD-HHmm")}`;
	while (taken.has(number)) {
		t = t.add(1, "minute");
		number = `MAJ-PO-${t.format("YYYYMMDD-HHmm")}`;
	}
	return number;
}

/** The date `days` working days (Mon–Fri) after `from`. */
export function addWorkingDays(from: string, days: number) {
	let d = dayjs(from);
	let left = days;
	while (left > 0) {
		d = d.add(1, "day");
		if (d.day() !== 0 && d.day() !== 6) left--;
	}
	return d.format("YYYY-MM-DD");
}

/** SKUs on orders not yet fully received: they're already on their way. */
export function skusOnOrder(orders: PurchaseOrder[]) {
	return new Set(
		orders.filter((po) => po.status !== "received").flatMap((po) => po.lines.map((l) => l.sku)),
	);
}

/**
 * One draft order per suggested group. An order is linked to a job card
 * when the parts on it are short for exactly one.
 */
export function draftsFromGroups(
	groups: OrderGroup[],
	{
		inventory,
		taken,
		raisedBy,
		today,
	}: { inventory: Inventory; taken: Set<string>; raisedBy: string; today: string },
): PurchaseOrder[] {
	const shortfalls = shortfallsOf(inventory);
	const used = new Set(taken);
	return groups.map((g) => {
		const number = poNumber(used);
		used.add(number);
		const jobs = [
			...new Map(
				shortfalls
					.filter((s) => g.lines.some((l) => l.sku === s.sku))
					.map((s) => [s.jobCard, s.client]),
			),
		];
		return {
			number,
			date: today,
			raisedBy,
			supplierId: g.supplierId,
			lines: g.lines.map((l) => ({
				sku: l.sku,
				name: l.name,
				unit: l.unit,
				ordered: l.qty,
				received: 0,
				unitCost: l.price,
			})),
			status: "draft",
			expected: null,
			deliveredOn: null,
			quality: null,
			approvalRequested: null,
			jobCard: jobs.length === 1 ? jobs[0][0] : null,
			client: jobs.length === 1 ? jobs[0][1] : null,
			deliverTo: DELIVER_TO[0],
			paymentTerms: PAYMENT_TERMS[0],
			note: "",
		};
	});
}

// ─── Sample data ─────────────────────────────────────────────────────────────
// TODO: replace with the purchase_orders table once there's a backend. The
// orders are the design's sample (all illustrative). The pages only read
// orders through getPurchaseOrders, so swapping in real data is a one-file
// change.

const BY = "Ifeanyi Nwosu";

const restock = (
	number: string,
	date: string,
	supplierId: string,
	lines: POLine[],
	status: POStatus,
	expected: string | null,
	extra: Partial<PurchaseOrder> = {},
): PurchaseOrder => ({
	number,
	date,
	raisedBy: BY,
	supplierId,
	lines,
	status,
	expected,
	deliveredOn: status === "received" ? expected : null,
	quality: status === "received" || status === "part" ? "As ordered" : null,
	approvalRequested: null,
	jobCard: null,
	client: null,
	deliverTo: DELIVER_TO[0],
	paymentTerms: PAYMENT_TERMS[0],
	note: "",
	...extra,
});

const line = (
	sku: string,
	name: string,
	unit: string,
	ordered: number,
	received: number,
	unitCost: number,
): POLine => ({ sku, name, unit, ordered, received, unitCost });

const ORDERS: PurchaseOrder[] = [
	restock(
		"MAJ-PO-20261106-1120",
		"2026-11-06",
		"balogun-textiles",
		[line("UPH-BCL-OAT", "Bouclé fabric, oat", "yard", 40, 0, 9800)],
		"sent",
		"2026-11-10",
	),
	restock(
		"MAJ-PO-20261104-0945",
		"2026-11-04",
		"lagos-foam-supply",
		[line("UPH-FOAM-40", "High-density foam 40D", "sheet", 10, 6, 32000)],
		"part",
		"2026-11-08",
		{ deliveredOn: "2026-11-06" },
	),
	restock(
		"MAJ-PO-20261103-1600",
		"2026-11-03",
		"springfield-seating-ltd",
		[line("SEA-PKT-3S", "Pocket spring unit", "set", 4, 4, 45000)],
		"received",
		"2026-11-06",
	),
	restock(
		"MAJ-PO-20261102-1410",
		"2026-11-02",
		"ogun-timber-co",
		[line("TMB-WAL-24", "Walnut hardwood", "piece", 60, 0, 18500)],
		"approval",
		null,
		{ approvalRequested: "2 Nov, 14:12" },
	),
	restock(
		"MAJ-PO-20261028-1030",
		"2026-10-28",
		"ladipo-hardware-traders",
		[
			line("HDW-LEG-BR6", "Tapered brass legs", "piece", 32, 32, 6500),
			line("HDW-INL-8MM", "Brass inlay strip", "metre", 40, 40, 4500),
		],
		"received",
		"2026-10-30",
	),
];

export async function getPurchaseOrders(): Promise<PurchaseOrder[]> {
	return ORDERS;
}
