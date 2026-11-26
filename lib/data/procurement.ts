import { cache } from "react";
import dayjs from "dayjs";
import type { Inventory, Part, PartCategory } from "@/lib/inventory";
import type { DeliveryQuality, POStatus, PurchaseOrder } from "@/lib/purchaseOrders";
import type {
	Material,
	Supplier,
	SupplierCatalog,
	SupplierMaterial,
	SupplierPurchaseOrder,
} from "@/lib/suppliers";
import { getPartDemand } from "@/lib/data/jobCards";
import { createClient } from "@/utils/supabase/server";

const PART_COLUMNS =
	"sku, name, category, unit, spec, unit_cost, cost_updated_on, cost_updated_by, in_stock, reserved, reorder_level, supplier_id, notes, photo_url";

const PO_COLUMNS =
	"number, order_date, raised_by, supplier_id, status, expected, delivered_on, quality, approval_requested_at, job_card, client, deliver_to, payment_terms, note, suppliers(business), purchase_order_lines(sku, name, unit, ordered, received, unit_cost)";

type PartRow = {
	sku: string;
	name: string;
	category: string;
	unit: string;
	spec: string;
	unit_cost: number | string;
	cost_updated_on: string;
	cost_updated_by: string;
	in_stock: number | string;
	reserved: number | string;
	reorder_level: number | string;
	supplier_id: string | null;
	notes: string;
	photo_url: string | null;
};

type PORow = {
	number: string;
	order_date: string;
	raised_by: string;
	supplier_id: string;
	status: POStatus;
	expected: string | null;
	delivered_on: string | null;
	quality: DeliveryQuality | null;
	approval_requested_at: string | null;
	job_card: string | null;
	client: string | null;
	deliver_to: string;
	payment_terms: string;
	note: string;
	suppliers: { business: string } | null;
	purchase_order_lines: {
		sku: string;
		name: string;
		unit: string;
		ordered: number | string;
		received: number | string;
		unit_cost: number | string;
	}[];
};

export const toPart = (row: PartRow): Part => ({
	id: row.sku,
	sku: row.sku,
	name: row.name,
	category: row.category as PartCategory,
	unit: row.unit,
	spec: row.spec,
	unitCost: Number(row.unit_cost),
	costUpdatedOn: row.cost_updated_on,
	costUpdatedBy: row.cost_updated_by,
	inStock: Number(row.in_stock),
	reserved: Number(row.reserved),
	reorderLevel: Number(row.reorder_level),
	supplierId: row.supplier_id ?? "",
	notes: row.notes,
	photoUrl: row.photo_url ?? undefined,
});

const toPurchaseOrder = (row: PORow): PurchaseOrder => ({
	number: row.number,
	date: row.order_date,
	raisedBy: row.raised_by,
	supplierId: row.supplier_id,
	supplierName: row.suppliers?.business ?? "",
	lines: row.purchase_order_lines.map((l) => ({
		sku: l.sku,
		name: l.name,
		unit: l.unit,
		ordered: Number(l.ordered),
		received: Number(l.received),
		unitCost: Number(l.unit_cost),
	})),
	status: row.status,
	expected: row.expected,
	deliveredOn: row.delivered_on,
	quality: row.quality,
	approvalRequested: row.approval_requested_at
		? dayjs(row.approval_requested_at).format("D MMM, HH:mm")
		: null,
	jobCard: row.job_card,
	client: row.client,
	deliverTo: row.deliver_to,
	paymentTerms: row.payment_terms,
	note: row.note,
});

/** Memoized per request so pages loading orders + supplier catalog query purchase_orders once. */
const fetchPurchaseOrders = cache(async (): Promise<PurchaseOrder[]> => {
	const supabase = await createClient();
	const { data, error } = await supabase
		.from("purchase_orders")
		.select(PO_COLUMNS)
		.order("order_date", { ascending: false })
		.order("number", { ascending: false });

	if (error) throw new Error(`Failed to load purchase orders: ${error.message}`);
	return ((data ?? []) as unknown as PORow[]).map(toPurchaseOrder);
});

/** Memoized per request so pages loading inventory + supplier catalog query parts once. */
const fetchActiveParts = cache(async (): Promise<Part[]> => {
	const supabase = await createClient();
	const { data, error } = await supabase
		.from("parts")
		.select(PART_COLUMNS)
		.eq("is_archived", false)
		.order("name", { ascending: true });

	if (error) throw new Error(`Failed to load inventory: ${error.message}`);
	return ((data ?? []) as PartRow[]).map(toPart);
});

export async function getPurchaseOrders(): Promise<PurchaseOrder[]> {
	return fetchPurchaseOrders();
}

export async function getInventory(): Promise<Inventory> {
	const [parts, demand] = await Promise.all([
		fetchActiveParts(),
		// What open job cards still need beyond what's reserved for them
		getPartDemand(),
	]);

	return { parts, demand };
}

const lineTotal = (po: PurchaseOrder) =>
	po.lines.reduce((sum, l) => sum + l.ordered * l.unitCost, 0);

/** What a supplier's page shows of an order: delivered ones with how late, open ones with when. */
function toSupplierOrder(po: PurchaseOrder): SupplierPurchaseOrder {
	const delivered = po.status === "received";
	let note = "";
	if (delivered && po.deliveredOn) {
		const late = po.expected ? dayjs(po.deliveredOn).diff(po.expected, "day") : 0;
		note = late > 0 ? `${late} ${late === 1 ? "day" : "days"} late` : "On time";
	} else if (po.expected) {
		note = `Expected ${dayjs(po.expected).format("D MMM")}`;
	}
	return {
		number: po.number,
		date: po.date,
		items: po.lines.map((l) => l.name).join(", "),
		total: lineTotal(po),
		status: delivered ? "delivered" : "sent",
		note,
	};
}

export async function getSupplierCatalog(): Promise<SupplierCatalog> {
	const supabase = await createClient();
	const [suppliersRes, materialsRes, parts, orders] = await Promise.all([
		supabase
			.from("suppliers")
			.select(
				"id, business, contact, address, area, phone, email, bank_name, account_number, account_name, notes, since",
			)
			.eq("is_active", true)
			.order("business", { ascending: true }),
		supabase
			.from("supplier_materials")
			.select(
				"supplier_id, sku, price, lead_days, min_order, quality, reliability, availability, rated_on, rated_by, rating_note, is_preferred",
			),
		fetchActiveParts(),
		fetchPurchaseOrders(),
	]);

	for (const res of [suppliersRes, materialsRes]) {
		if (res.error) throw new Error(`Failed to load suppliers: ${res.error.message}`);
	}

	const materials: Material[] = parts.map((p) => ({
		sku: p.sku,
		name: p.name,
		unit: p.unit,
	}));

	const preferred: Record<string, string> = {};
	const bySupplier = new Map<string, SupplierMaterial[]>();
	for (const m of materialsRes.data ?? []) {
		if (m.is_preferred) preferred[m.sku] = m.supplier_id;
		const list = bySupplier.get(m.supplier_id) ?? [];
		list.push({
			sku: m.sku,
			price: Number(m.price),
			leadDays: Number(m.lead_days),
			minOrder: m.min_order,
			ratings:
				m.quality === null
					? null
					: {
							quality: Number(m.quality),
							reliability: Number(m.reliability),
							availability: Number(m.availability),
						},
			ratedOn: m.rated_on,
			ratedBy: m.rated_by,
			ratingNote: m.rating_note,
		});
		bySupplier.set(m.supplier_id, list);
	}

	const sent = orders.filter((po) => po.status !== "draft" && po.status !== "approval");
	const year = dayjs().year();

	const suppliers: Supplier[] = (suppliersRes.data ?? []).map((s) => {
		const mine = sent.filter((po) => po.supplierId === s.id);
		const delivered = mine.filter((po) => po.deliveredOn);
		const onTime = delivered.filter(
			(po) => !po.expected || !dayjs(po.deliveredOn).isAfter(po.expected, "day"),
		).length;
		const paidThisYear = mine
			.filter((po) => po.deliveredOn && dayjs(po.deliveredOn).year() === year)
			.reduce(
				(sum, po) => sum + po.lines.reduce((t, l) => t + l.received * l.unitCost, 0),
				0,
			);

		return {
			id: s.id,
			business: s.business,
			contact: s.contact,
			address: s.address,
			area: s.area,
			phone: s.phone,
			email: s.email,
			bankDetails: {
				bank: s.bank_name,
				accountNumber: s.account_number,
				accountName: s.account_name,
			},
			notes: s.notes,
			since: dayjs(s.since).format("MMM YYYY"),
			onTimePercent: delivered.length ? Math.round((onTime / delivered.length) * 100) : 0,
			deliveries: delivered.length,
			paidThisYear,
			materials: bySupplier.get(s.id) ?? [],
			purchaseOrders: mine.map(toSupplierOrder),
		};
	});

	return { suppliers, preferred, materials };
}
