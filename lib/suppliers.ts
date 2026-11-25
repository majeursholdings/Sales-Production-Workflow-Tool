import dayjs from "dayjs";
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
	contact: string;
	address: string;
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

export const materialOf = (sku: string): Material =>
	MATERIALS.find((m) => m.sku === sku) ?? { sku, name: sku, unit: "unit" };

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

// ─── Sample data ─────────────────────────────────────────────────────────────
// TODO: replace with real suppliers once there's a backend. The sample
// suppliers from the design (all illustrative). Materials should come from the
// inventory table then; four of these aren't in the inventory sample yet. The
// pages only read suppliers through getSupplierCatalog, so swapping in real
// data is a one-file change.

export const MATERIALS: Material[] = [
	{ sku: "TMB-WAL-24", name: "Walnut hardwood", unit: "piece" },
	{ sku: "TMB-WAL-SLB", name: "Walnut slab", unit: "slab" },
	{ sku: "TMB-WAL-VEN", name: "Walnut veneer board", unit: "board" },
	{ sku: "UPH-FOAM-40", name: "High-density foam 40D", unit: "sheet" },
	{ sku: "UPH-BCL-OAT", name: "Bouclé fabric, oat", unit: "yard" },
	{ sku: "UPH-CORD-NAT", name: "Woven paper cord", unit: "metre" },
	{ sku: "SEA-PKT-3S", name: "Pocket spring unit", unit: "3-seat set" },
	{ sku: "HDW-LEG-BR6", name: "Tapered brass legs", unit: "piece" },
	{ sku: "HDW-INL-8MM", name: "Brass inlay strip", unit: "metre" },
	{ sku: "HDW-HDL-BR", name: "Brass handles", unit: "piece" },
	{ sku: "HDW-NAIL-BR", name: "Brass nailhead trim", unit: "stud" },
	{ sku: "FIN-HWX-1L", name: "Hardwax oil finish", unit: "tin" },
];

const RATER = "Ifeanyi Nwosu";

const offer = (
	sku: string,
	price: number,
	leadDays: number,
	minOrder: string,
	[quality, reliability, availability]: [number, number, number],
	ratedOn: string,
	ratingNote = "",
): SupplierMaterial => ({
	sku,
	price,
	leadDays,
	minOrder,
	ratings: { quality, reliability, availability },
	ratedOn,
	ratedBy: RATER,
	ratingNote,
});

const restock = (number: string, date: string, total: number): SupplierPurchaseOrder => ({
	number,
	date,
	items: "Restock order",
	total,
	status: "delivered",
	note: "On time",
});

const SUPPLIERS: Supplier[] = [
	{
		id: "ogun-timber-co",
		business: "Ogun Timber Co.",
		contact: "Kehinde Ojo",
		address: "KM 12 Abeokuta Expressway, Sango-Ota, Ogun",
		area: "Sango-Ota, Ogun",
		phone: "+234 803 410 2271",
		email: "kehinde.ojo@gmail.com",
		bankDetails: {
			bank: "Access Bank",
			accountNumber: "0123454821",
			accountName: "Ogun Timber Company Ltd",
		},
		notes: "Pays on delivery. Delivers Tuesdays and Fridays. Kiln-dried stock only; ask for moisture readings on slabs.",
		since: "Mar 2024",
		onTimePercent: 94,
		deliveries: 18,
		paidThisYear: 4820000,
		materials: [
			offer("TMB-WAL-24", 18500, 4, "10 pieces", [5, 5, 4], "2026-11-02"),
			offer("TMB-WAL-SLB", 98000, 10, "1 slab", [5, 4, 2], "2026-11-02"),
			offer("TMB-WAL-VEN", 26000, 6, "5 boards", [4, 4, 4], "2026-10-20"),
		],
		purchaseOrders: [
			{
				number: "MAJ-PO-20261107-1110",
				date: "2026-11-07",
				items: "Walnut slab × 3",
				total: 294000,
				status: "sent",
				note: "Expected 17 Nov",
			},
			{
				number: "MAJ-PO-20261102-0915",
				date: "2026-11-02",
				items: "Walnut hardwood × 24, walnut slab × 2",
				total: 640000,
				status: "delivered",
				note: "On time",
			},
		],
	},
	{
		id: "mushin-timber-yard",
		business: "Mushin Timber Yard",
		contact: "Sule Adamu",
		address: "3 Agege Motor Road, Mushin, Lagos",
		area: "Mushin, Lagos",
		phone: "+234 807 552 3190",
		email: "",
		bankDetails: { bank: "Opay", accountNumber: "8123349907", accountName: "Sule Adamu" },
		notes: "Cheaper, but grade varies. Inspect every load at the yard before paying.",
		since: "Aug 2025",
		onTimePercent: 78,
		deliveries: 9,
		paidThisYear: 1260000,
		materials: [
			offer("TMB-WAL-24", 16800, 7, "20 pieces", [3, 3, 5], "2026-10-28"),
			offer("TMB-WAL-SLB", 92000, 14, "1 slab", [4, 3, 2], "2026-10-28"),
		],
		purchaseOrders: [restock("MAJ-PO-20261028-1030", "2026-10-28", 320000)],
	},
	{
		id: "balogun-textiles",
		business: "Balogun Textiles",
		contact: "Funke Balogun",
		address: "14 Balogun Market, Lagos Island, Lagos",
		area: "Lagos Island",
		phone: "+234 805 227 9013",
		email: "",
		bankDetails: {
			bank: "Zenith Bank",
			accountNumber: "0987651130",
			accountName: "Funke Balogun",
		},
		notes: "Holds bolts for 48 hours on a WhatsApp confirmation. Same dye lot only if ordered together.",
		since: "Jan 2024",
		onTimePercent: 88,
		deliveries: 25,
		paidThisYear: 3140000,
		materials: [offer("UPH-BCL-OAT", 9800, 3, "10 yards", [4, 4, 4], "2026-10-28")],
		purchaseOrders: [restock("MAJ-PO-20261028-1045", "2026-10-28", 320000)],
	},
	{
		id: "aba-fabrics-ltd",
		business: "Aba Fabrics Ltd",
		contact: "Ifeoma Nnaji",
		address: "22 Ariaria Market Road, Aba, Abia",
		area: "Aba, Abia",
		phone: "+234 816 340 7782",
		email: "sales@abafabrics.ng",
		bankDetails: { bank: "UBA", accountNumber: "2087761143", accountName: "Aba Fabrics Ltd" },
		notes: "Ships by road from Aba; add 2 days in rainy season. 30-yard minimum.",
		since: "Jun 2025",
		onTimePercent: 70,
		deliveries: 6,
		paidThisYear: 890000,
		materials: [offer("UPH-BCL-OAT", 8900, 10, "30 yards", [4, 3, 3], "2026-10-15")],
		purchaseOrders: [restock("MAJ-PO-20261015-0930", "2026-10-15", 267000)],
	},
	{
		id: "lagos-foam-supply",
		business: "Lagos Foam Supply",
		contact: "Chidi Okonkwo",
		address: "210 Ikorodu Road, Palmgrove, Lagos",
		area: "Palmgrove, Lagos",
		phone: "+234 802 664 1180",
		email: "orders.lagosfoam@gmail.com",
		bankDetails: {
			bank: "GTBank",
			accountNumber: "0234567702",
			accountName: "Lagos Foam Supply Ltd",
		},
		notes: "Cuts to size for free on orders of 4 sheets or more.",
		since: "Feb 2024",
		onTimePercent: 100,
		deliveries: 12,
		paidThisYear: 2310000,
		materials: [offer("UPH-FOAM-40", 32000, 2, "2 sheets", [5, 5, 5], "2026-10-28")],
		purchaseOrders: [restock("MAJ-PO-20261028-1120", "2026-10-28", 192000)],
	},
	{
		id: "ikeja-foam-depot",
		business: "Ikeja Foam Depot",
		contact: "Ngozi Eze",
		address: "7 Oba Akran Avenue, Ikeja, Lagos",
		area: "Ikeja, Lagos",
		phone: "+234 809 771 2204",
		email: "",
		bankDetails: {
			bank: "Access Bank",
			accountNumber: "0441209987",
			accountName: "Ikeja Foam Depot",
		},
		notes: "Backup for foam. Stock runs low at month end.",
		since: "Sep 2025",
		onTimePercent: 83,
		deliveries: 6,
		paidThisYear: 640000,
		materials: [offer("UPH-FOAM-40", 30500, 3, "5 sheets", [4, 4, 3], "2026-10-21")],
		purchaseOrders: [restock("MAJ-PO-20261021-1400", "2026-10-21", 152500)],
	},
	{
		id: "ladipo-hardware-traders",
		business: "Ladipo Hardware Traders",
		contact: "Musa Ibrahim",
		address: "Shop 42, Ladipo Market, Mushin, Lagos",
		area: "Mushin, Lagos",
		phone: "+234 806 990 4412",
		email: "",
		bankDetails: {
			bank: "Moniepoint",
			accountNumber: "6012349956",
			accountName: "Musa Ibrahim",
		},
		notes: "Cash or transfer before collection. Check brass finish on every piece.",
		since: "Jan 2024",
		onTimePercent: 71,
		deliveries: 14,
		paidThisYear: 1480000,
		materials: [
			offer(
				"HDW-LEG-BR6",
				6500,
				5,
				"4 pieces",
				[3, 2, 4],
				"2026-10-30",
				"Arrived 3 days late; two legs had scratched brass.",
			),
			offer("HDW-INL-8MM", 4500, 5, "5 metres", [4, 3, 4], "2026-10-30"),
			offer("HDW-HDL-BR", 7800, 5, "4 pieces", [3, 2, 3], "2026-10-30"),
			offer("HDW-NAIL-BR", 450, 2, "100 studs", [4, 3, 5], "2026-10-30"),
			offer("FIN-HWX-1L", 3000, 2, "1 tin", [4, 4, 5], "2026-10-20"),
		],
		purchaseOrders: [
			{
				number: "MAJ-PO-20261030-1402",
				date: "2026-10-30",
				items: "Tapered brass legs × 16, inlay strip × 10 m",
				total: 149000,
				status: "delivered",
				note: "3 days late",
			},
		],
	},
	{
		id: "kano-metal-works",
		business: "Kano Metal Works",
		contact: "Abubakar Sani",
		address: "15 Sharada Industrial Estate, Kano",
		area: "Kano",
		phone: "+234 803 118 6620",
		email: "orders@kanometalworks.ng",
		bankDetails: {
			bank: "Jaiz Bank",
			accountNumber: "0007712345",
			accountName: "Kano Metal Works Ltd",
		},
		notes: "Solid brass, made to order. Ships by courier; tracking sent on dispatch.",
		since: "Jul 2025",
		onTimePercent: 90,
		deliveries: 5,
		paidThisYear: 780000,
		materials: [
			offer("HDW-LEG-BR6", 7200, 9, "8 pieces", [5, 4, 3], "2026-11-01"),
			offer("HDW-INL-8MM", 4900, 9, "10 metres", [5, 4, 3], "2026-11-01"),
			offer("HDW-HDL-BR", 8500, 9, "6 pieces", [5, 4, 4], "2026-11-01"),
		],
		purchaseOrders: [restock("MAJ-PO-20261101-1015", "2026-11-01", 245000)],
	},
	{
		id: "springfield-seating-ltd",
		business: "Springfield Seating Ltd",
		contact: "Grace Adeyemi",
		address: "Plot 8, Agbara Industrial Estate, Ogun",
		area: "Agbara, Ogun",
		phone: "+234 809 115 7720",
		email: "grace@springfieldseating.ng",
		bankDetails: {
			bank: "First Bank",
			accountNumber: "3011228874",
			accountName: "Springfield Seating Ltd",
		},
		notes: "Sizes to order for curved seats with 2 weeks’ notice.",
		since: "Apr 2024",
		onTimePercent: 85,
		deliveries: 7,
		paidThisYear: 630000,
		materials: [offer("SEA-PKT-3S", 45000, 6, "1 set", [4, 4, 4], "2026-10-25")],
		purchaseOrders: [restock("MAJ-PO-20261025-0845", "2026-10-25", 180000)],
	},
	{
		id: "coastline-cord-imports",
		business: "Coastline Cord Imports",
		contact: "Tayo Bankole",
		address: "5 Warehouse Road, Apapa, Lagos",
		area: "Apapa, Lagos",
		phone: "+234 813 228 0045",
		email: "",
		bankDetails: { bank: "", accountNumber: "", accountName: "" },
		notes: "Imported; port delays are common. Order well ahead.",
		since: "May 2025",
		onTimePercent: 50,
		deliveries: 4,
		paidThisYear: 210000,
		materials: [
			offer(
				"UPH-CORD-NAT",
				1800,
				21,
				"40 metres",
				[4, 1, 2],
				"2026-11-01",
				"Container held at port for 12 days.",
			),
		],
		purchaseOrders: [restock("MAJ-PO-20261101-1130", "2026-11-01", 72000)],
	},
];

const PREFERRED: Record<string, string> = {
	"TMB-WAL-24": "ogun-timber-co",
	"TMB-WAL-SLB": "ogun-timber-co",
	"UPH-BCL-OAT": "balogun-textiles",
	"UPH-FOAM-40": "lagos-foam-supply",
	"HDW-LEG-BR6": "ladipo-hardware-traders",
	"HDW-INL-8MM": "ladipo-hardware-traders",
	"HDW-HDL-BR": "kano-metal-works",
};

export async function getSupplierCatalog(): Promise<SupplierCatalog> {
	return { suppliers: SUPPLIERS, preferred: PREFERRED };
}

/** Ids with a sample record, so the detail route can be prerendered. */
export const sampleSupplierIds = SUPPLIERS.map((s) => s.id);
