import dayjs from "dayjs";
import type { PostalAddress } from "@/lib/address";
import type { BadgeVariant } from "@/components/common/badge";
import type { OverviewItem } from "@/components/common/overViewCard";
import { wholeNaira } from "@/lib/quoteBuilder";

// ─── Types ───────────────────────────────────────────────────────────────────

/** A material suppliers can sell us, as inventory knows it. */
export type Material = {
	sku: string;
	name: string;
	/** Singular unit it's priced per, e.g. "piece", "yard". */
	unit: string;
};

/** Procurement's three ratings, each 1 (poor) to 5 (excellent). */
export type Ratings = { quality: number; reliability: number; availability: number };
export type RatingKey = keyof Ratings;

/** One material one supplier sells us: their price and terms, and how procurement rates them for it. */
export type SupplierMaterial = {
	sku: string;
	/** Their price per unit, in naira. */
	price: number;
	/** Working days from order to delivery. */
	leadDays: number;
	/** Minimum order, in words, e.g. "10 pieces". */
	minOrder: string;
	/** Null until it's rated after the first delivery. */
	ratings: Ratings | null;
	/** ISO date of the last rating. */
	ratedOn: string | null;
	ratedBy: string | null;
	/** What happened on the last delivery, kept with the rating. */
	ratingNote: string;
};

export type PurchaseOrderStatus = "sent" | "delivered";

export type SupplierPurchaseOrder = {
	number: string;
	/** ISO date. */
	date: string;
	items: string;
	total: number;
	status: PurchaseOrderStatus;
	/** e.g. "On time", "3 days late", "Expected 17 Nov". */
	note: string;
};

export type BankDetails = { bank: string; accountNumber: string; accountName: string };

export type Supplier = {
	id: string;
	business: string;
	/** The person we deal with, written out. */
	contact: string;
	contactTitle: string;
	contactFirstName: string;
	contactSurname: string;
	/** Written out, e.g. "KM 12 Abeokuta Expressway, Sango-Ota, Ogun, Nigeria". */
	address: string;
	/** The same address in parts; null for suppliers saved before addresses were split up. */
	addressParts: PostalAddress | null;
	/** Short area for the table, e.g. "Sango-Ota, Ogun". */
	area: string;
	phone: string;
	email: string;
	/** Empty strings until they're added. */
	bankDetails: BankDetails;
	notes: string;
	/** When we started buying from them, as the team says it, e.g. "Mar 2024". */
	since: string;
	/** Share of deliveries that arrived on the promised date, 0–100. */
	onTimePercent: number;
	deliveries: number;
	paidThisYear: number;
	materials: SupplierMaterial[];
	/** Newest first. */
	purchaseOrders: SupplierPurchaseOrder[];
};

/**
 * Every supplier plus who's preferred for each material. Kept together
 * because comparing suppliers of a material reads across all of them.
 */
export type SupplierCatalog = {
	suppliers: Supplier[];
	/** Material SKU → id of the supplier suggested first on purchase orders. */
	preferred: Record<string, string>;
	/** Every active inventory part suppliers can sell us. */
	materials: Material[];
};

// ─── Ratings and scores ──────────────────────────────────────────────────────

export const RATING_CRITERIA: { key: RatingKey; label: string; hint: string }[] = [
	{ key: "quality", label: "Quality", hint: "Grade, finish and consistency of what arrives." },
	{
		key: "reliability",
		label: "Reliability",
		hint: "Delivers on the date promised, in the quantity ordered.",
	},
	{ key: "availability", label: "Availability", hint: "Has it in stock when we order." },
];

/** What each step of a rating means, indexed by the rating (1–5). */
export const RATING_WORDS = ["", "Poor", "Below what we need", "Acceptable", "Good", "Excellent"];

/** The average of the three ratings, or null when it isn't rated yet. */
export const scoreOf = (ratings: Ratings | null) =>
	ratings ? (ratings.quality + ratings.reliability + ratings.availability) / 3 : null;

export const formatScore = (score: number | null) => (score === null ? "—" : score.toFixed(1));

/** A supplier's overall rating: the average score of the materials it's rated on. */
export function supplierRating(supplier: Supplier): number | null {
	const scores = supplier.materials
		.map((m) => scoreOf(m.ratings))
		.filter((s): s is number => s !== null);
	return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
}

// ─── Materials across suppliers ──────────────────────────────────────────────

export const materialOf = (catalog: Pick<SupplierCatalog, "materials">, sku: string): Material =>
	catalog.materials.find((m) => m.sku === sku) ?? { sku, name: sku, unit: "unit" };

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export const daysLabel = (days: number) => plural(days, "day");

export const dateLabel = (iso: string) => dayjs(iso).format("D MMM YYYY");

/** One supplier's offer for a material, with who's offering it. */
export type MaterialOffer = SupplierMaterial & { supplier: Supplier; score: number | null };

/** Everyone who supplies a material, best score first (unrated last). */
export function offersFor(catalog: SupplierCatalog, sku: string): MaterialOffer[] {
	return catalog.suppliers
		.flatMap((supplier) =>
			supplier.materials
				.filter((m) => m.sku === sku)
				.map((m) => ({ ...m, supplier, score: scoreOf(m.ratings) })),
		)
		.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
}

/** Who's suggested first for a material: the chosen one, or the only supplier when there's one. */
export function preferredSupplierId(catalog: SupplierCatalog, sku: string): string | null {
	const offers = offersFor(catalog, sku);
	const chosen = catalog.preferred[sku];
	if (chosen && offers.some((o) => o.supplier.id === chosen)) return chosen;
	return offers.length === 1 ? offers[0].supplier.id : null;
}

/** How one supplier's price and lead time compare with the others for the same material. */
export function compareOffer(catalog: SupplierCatalog, supplierId: string, sku: string) {
	const offers = offersFor(catalog, sku);
	const mine = offers.find((o) => o.supplier.id === supplierId);
	const count = offers.length;
	const lowestPrice = Math.min(...offers.map((o) => o.price));
	const fastest = Math.min(...offers.map((o) => o.leadDays));
	const isLowest = count > 1 && mine?.price === lowestPrice;
	const isFastest = count > 1 && mine?.leadDays === fastest;
	const rated = offers.filter((o) => o.score !== null);
	const rank = rated.findIndex((o) => o.supplier.id === supplierId) + 1;
	const others = count - 1;

	return {
		count,
		isLowest,
		isFastest,
		priceNote:
			count === 1
				? "Only supplier"
				: isLowest
					? `Lowest of ${count}`
					: `${wholeNaira((mine?.price ?? 0) - lowestPrice)} above lowest`,
		leadNote:
			count === 1
				? ""
				: isFastest
					? `Fastest of ${count}`
					: `${daysLabel((mine?.leadDays ?? 0) - fastest)} slower`,
		othersNote: others
			? `Also from ${plural(others, "other supplier")}`
			: "No other supplier yet",
		/** 1-based rank on score among the rated suppliers, or 0 when this one isn't rated. */
		rank,
		ratedCount: rated.length,
	};
}

// ─── Overview figures ────────────────────────────────────────────────────────

export function buildSupplierOverview(
	catalog: SupplierCatalog,
	supplier: Supplier,
): OverviewItem[] {
	const rating = supplierRating(supplier);
	const rated = supplier.materials.filter((m) => m.ratings).length;
	const preferredFor = supplier.materials.filter(
		(m) => preferredSupplierId(catalog, m.sku) === supplier.id,
	).length;
	const open = supplier.purchaseOrders.filter((po) => po.status === "sent");
	const openTotal = open.reduce((sum, po) => sum + po.total, 0);

	return [
		{
			label: "Overall rating",
			value: rating === null ? "—" : `${formatScore(rating)} / 5`,
			note: rated ? `Average of ${plural(rated, "rated material")}` : "Not rated yet",
		},
		{
			label: "Preferred supplier for",
			value: plural(preferredFor, "material"),
			note: `Of ${supplier.materials.length} it supplies`,
		},
		{
			label: "Deliveries",
			value: `${supplier.onTimePercent}% on time`,
			note: `${plural(supplier.deliveries, "delivery", "deliveries")} since ${supplier.since}`,
		},
		{
			label: "Paid this year",
			value: wholeNaira(supplier.paidThisYear),
			note: open.length
				? `${plural(open.length, "order")} open, ${wholeNaira(openTotal)}`
				: "No open orders",
		},
	];
}

export const PO_STATUS: Record<PurchaseOrderStatus, { label: string; tone: BadgeVariant }> = {
	sent: { label: "Sent", tone: "info" },
	delivered: { label: "Delivered", tone: "success" },
};

/** A URL id from a business name, unique among the ids already taken. */
export function supplierId(business: string, taken: Set<string>) {
	const base =
		business
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-|-$/g, "") || "supplier";
	let id = base;
	for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
	return id;
}
