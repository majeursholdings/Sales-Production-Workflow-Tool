import dayjs from "dayjs";
import {
	offersFor,
	plural,
	preferredSupplierId,
	supplierRating,
	formatScore,
	type SupplierCatalog,
} from "@/lib/suppliers";

// ─── Types ───────────────────────────────────────────────────────────────────

export const PART_CATEGORIES = [
	"Timber",
	"Upholstery",
	"Seating",
	"Hardware",
	"Finishing",
] as const;
export type PartCategory = (typeof PART_CATEGORIES)[number];

/** SKU prefix per category, e.g. TMB-WAL-24. */
export const CATEGORY_PREFIX: Record<PartCategory, string> = {
	Timber: "TMB",
	Upholstery: "UPH",
	Seating: "SEA",
	Hardware: "HDW",
	Finishing: "FIN",
};

/** Units offered when adding a part. A part keeps any other unit it already has. */
export const PART_UNITS = ["piece", "metre", "yard", "sheet", "set", "litre", "slab", "tin"];

/** A part we stock and price quotes with. */
export type Part = {
	/** Same as the SKU: set when the part is created and never changes. */
	id: string;
	sku: string;
	name: string;
	category: PartCategory;
	/** Singular unit it's counted and priced per, e.g. "piece", "yard". */
	unit: string;
	/** Size, finish, grade, e.g. "6\" thick". */
	spec: string;
	/** Naira per unit. Used for new quotes only. */
	unitCost: number;
	/** ISO date of the last cost change. */
	costUpdatedOn: string;
	costUpdatedBy: string;
	inStock: number;
	/** Held for confirmed job cards. */
	reserved: number;
	/** Flagged Low when available stock falls below this. */
	reorderLevel: number;
	/** Main supplier, suggested first on purchase orders. */
	supplierId: string;
	notes: string;
	/** Photo picked this session (an object URL) until photo upload is connected. */
	photoUrl?: string;
};

/** What a confirmed job card still needs of a part beyond what's reserved for it. */
export type PartDemand = {
	sku: string;
	jobCard: string;
	client: string;
	/** Units still needed. */
	qty: number;
};

export type Inventory = {
	parts: Part[];
	demand: PartDemand[];
};

// ─── Stock figures ───────────────────────────────────────────────────────────

export const availableOf = (p: Part) => p.inStock - p.reserved;

/** "Out" at nothing available, "Low" below the reorder level, else null. */
export function stockFlag(p: Part): "Out" | "Low" | null {
	const avail = availableOf(p);
	if (avail <= 0) return "Out";
	if (avail < p.reorderLevel) return "Low";
	return null;
}

/** "3 slabs", "1 slab", "16 metres". */
export const qtyLabel = (n: number, unit: string) => plural(n, unit);

/** One part a confirmed job card is short of: what's needed beyond what's available. */
export type Shortfall = PartDemand & { short: number };

/** Parts confirmed job cards need more of than is available, per job card. */
export function shortfallsOf(inventory: Inventory): Shortfall[] {
	return inventory.demand.flatMap((d) => {
		const part = inventory.parts.find((p) => p.sku === d.sku);
		if (!part) return [];
		const short = d.qty - Math.max(0, availableOf(part));
		return short > 0 ? [{ ...d, short }] : [];
	});
}

/** "Walnut slab and 16 metres more woven paper cord": what a job card is short, in words. */
export function shortfallSentence(parts: Part[], shortfalls: Shortfall[]) {
	const phrases = shortfalls.map((s) => {
		const part = parts.find((p) => p.sku === s.sku);
		const name = (part?.name ?? s.sku).toLowerCase();
		const unit = part?.unit ?? "unit";
		return s.short === 1 && ["piece", "slab", "sheet", "set"].includes(unit)
			? `a ${name}`
			: `${qtyLabel(s.short, unit)} more ${name}`;
	});
	return phrases.length > 1
		? `${phrases.slice(0, -1).join(", ")} and ${phrases.at(-1)}`
		: (phrases[0] ?? "");
}

export const costLabel = (n: number) => `₦${n.toLocaleString("en-NG")}`;

export const costUpdatedLabel = (p: Part, today: string) =>
	p.costUpdatedOn === today ? "Today" : dayjs(p.costUpdatedOn).format("D MMM YYYY");

/** A SKU from the category and name, e.g. Hardware + "Brass corner caps" → HDW-BRA-COR. Unique among `taken`. */
export function suggestSku(category: PartCategory, name: string, taken: Set<string>) {
	const words = name
		.toUpperCase()
		.replace(/[^A-Z0-9 ]+/g, " ")
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((w) => w.slice(0, 3));
	const base = [CATEGORY_PREFIX[category], ...(words.length ? words : ["NEW"])].join("-");
	let sku = base;
	for (let n = 2; taken.has(sku); n++) sku = `${base}-${n}`;
	return sku;
}

// ─── Purchase order suggestions ──────────────────────────────────────────────

/** One part to order: why, and how many by default. */
export type OrderLine = {
	sku: string;
	name: string;
	unit: string;
	/** Short for a job card, or at/below the reorder level, in words. */
	why: string;
	/** Shortfall plus the reorder level. */
	qty: number;
	/** The supplier's price, or the part's unit cost when they don't list it. */
	price: number;
};

/** One draft order: a supplier and the parts to order from them. */
export type OrderGroup = {
	supplierId: string;
	supplier: string;
	/** "Rated 4.6 · usually 4 working days". */
	meta: string;
	lines: OrderLine[];
};

/**
 * Parts short for job cards or at/below their reorder level, grouped by
 * main supplier: one draft order per supplier.
 */
export function suggestOrders(inventory: Inventory, catalog: SupplierCatalog): OrderGroup[] {
	const shortfalls = shortfallsOf(inventory);
	const groups = new Map<string, OrderGroup>();

	for (const part of inventory.parts) {
		const mine = shortfalls.filter((s) => s.sku === part.sku);
		const short = mine.reduce((sum, s) => sum + s.short, 0);
		const avail = availableOf(part);
		if (short === 0 && avail > part.reorderLevel) continue;

		const supplierId = part.supplierId || preferredSupplierId(catalog, part.sku) || "";
		const supplier = catalog.suppliers.find((s) => s.id === supplierId);
		const offer = offersFor(catalog, part.sku).find((o) => o.supplier.id === supplierId);
		const level = qtyLabel(part.reorderLevel, part.unit);
		const why = short
			? `Short ${qtyLabel(short, part.unit)} for ${mine.map((s) => s.jobCard).join(", ")}, reorder level ${level}`
			: avail === part.reorderLevel
				? `${avail} available, at reorder level`
				: `${Math.max(0, avail)} available, reorder level ${level}`;

		const group = groups.get(supplierId) ?? {
			supplierId,
			supplier: supplier?.business ?? "No supplier set",
			meta: "",
			lines: [],
		};
		group.lines.push({
			sku: part.sku,
			name: part.name,
			unit: part.unit,
			why,
			qty: short + part.reorderLevel,
			price: offer?.price ?? part.unitCost,
		});
		const rating = supplier ? supplierRating(supplier) : null;
		const lead = Math.max(
			0,
			...group.lines.map(
				(l) =>
					offersFor(catalog, l.sku).find((o) => o.supplier.id === supplierId)?.leadDays ??
					0,
			),
		);
		group.meta = [
			rating === null ? "Not rated yet" : `Rated ${formatScore(rating)}`,
			lead ? `usually ${plural(lead, "working day")}` : "",
		]
			.filter(Boolean)
			.join(" · ");
		groups.set(supplierId, group);
	}
	return [...groups.values()];
}
