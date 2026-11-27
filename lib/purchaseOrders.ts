import dayjs from "dayjs";
import type { BadgeVariant } from "@/components/common/badge";
import { addressLine } from "@/lib/address";
import type { CompanyAddress } from "@/lib/companySettings";
import { shortfallsOf, type Inventory, type OrderGroup } from "@/lib/inventory";

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
	/** The supplier's business name, kept even after the supplier is deleted. */
	supplierName: string;
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

/** Who approves orders over the approval limit (Settings → Tax & limits). */
export const APPROVERS = "the MD or GM";
export const APPROVERS_BOTH = "the MD and GM";

/** Stored as the order's "deliver to" when we collect from the supplier ourselves. */
export const PICKUP = "Pick up from supplier";

/** "Workshop · 14 Oba Akran Ave, Ikeja, Lagos, Nigeria": how a company address is written on an order. */
export const deliveryLabel = (a: CompanyAddress) => `${a.name} · ${addressLine(a)}`;

/** The "Deliver to" choices: Settings → Company details addresses, then pickup. */
export const deliverToOptions = (addresses: CompanyAddress[]) => [
	...addresses.map(deliveryLabel),
	PICKUP,
];

export const PAYMENT_TERMS = [
	"50% upfront, 50% on delivery",
	"100% upfront",
	"Pay on delivery",
	"Pay on pickup",
	"30 days after delivery",
];

export const poTotal = (po: Pick<PurchaseOrder, "lines">) =>
	po.lines.reduce((sum, l) => sum + l.ordered * l.unitCost, 0);

export const needsApproval = (total: number, limit: number) => total > limit;

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
export function poNumber(taken: Set<string>, now = dayjs(), prefix = "MAJ-PO-") {
	let t = now;
	let number = `${prefix}${t.format("YYYYMMDD-HHmm")}`;
	while (taken.has(number)) {
		t = t.add(1, "minute");
		number = `${prefix}${t.format("YYYYMMDD-HHmm")}`;
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
			supplierName: g.supplier,
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
			// Filled in with the default delivery address when it's saved.
			deliverTo: "",
			paymentTerms: PAYMENT_TERMS[0],
			note: "",
		};
	});
}

/** What the server needs to create an order from a drafted one (it assigns the number). */
export const orderInput = (po: PurchaseOrder, send = false) => ({
	supplierId: po.supplierId,
	lines: po.lines.map(({ sku, name, unit, ordered, unitCost }) => ({
		sku,
		name,
		unit,
		ordered,
		unitCost,
	})),
	send,
	expected: po.expected,
	jobCard: po.jobCard,
	client: po.client,
	deliverTo: po.deliverTo,
	paymentTerms: po.paymentTerms,
	note: po.note,
});
