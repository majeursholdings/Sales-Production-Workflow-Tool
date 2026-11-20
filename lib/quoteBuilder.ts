import { DEFAULT_CURRENCY_SYMBOL } from "@/lib/currency";
import type { Client } from "@/lib/clients";
import { VAT_RATE } from "@/lib/quotes";

/**
 * TODO: replace the catalogue, rates and constants below with real data
 * (furniture types, Cost rates, Settings) once they exist. They are the sample
 * values from the quote builder design.
 */

export const USD_RATE = 1460;
export const DEPOSIT_RATE = 0.7;
export const VALID_DAYS = 7;
const OVERHEAD_PER_LABOUR_HOUR = 3673;
const CONTINGENCY = 0.05;
const WRAPPING = 4000;
/** The most a general discount can be, as a percentage of the price before VAT. */
export const MAX_GENERAL_DISCOUNT = 3;

export type Currency = "NGN" | "USD";

type CatalogPart = { name: string; detail: string; spec: string; qty: number; unit: number };
type CatalogHours = { name: string; rate: number; hours: number };
export type CatalogItem = {
	id: string;
	name: string;
	meta: string;
	markup: number;
	markupCap: number;
	parts: CatalogPart[];
	labour: CatalogHours[];
	machines: CatalogHours[];
};

export const CATALOG: CatalogItem[] = [
	{
		id: "sofa",
		name: "3-seater sofa",
		meta: "Sofas · Walnut frame, oat bouclé upholstery",
		markup: 0.35,
		markupCap: 0.4,
		parts: [
			{
				name: "Walnut hardwood",
				detail: "Frame · 34 available",
				spec: '2" × 4", kiln-dried',
				qty: 12,
				unit: 18500,
			},
			{
				name: "High-density foam 40D",
				detail: "Cushioning · 6 available",
				spec: '6" sheet',
				qty: 3,
				unit: 32000,
			},
			{
				name: "Bouclé fabric, oat",
				detail: "Upholstery · 46 yd available",
				spec: "Per yard",
				qty: 14,
				unit: 9800,
			},
			{
				name: "Pocket spring unit",
				detail: "Seating · 4 available",
				spec: "3-seat set",
				qty: 1,
				unit: 45000,
			},
			{
				name: "Tapered brass legs",
				detail: "Hardware · 28 available",
				spec: '6", set screw',
				qty: 4,
				unit: 6500,
			},
		],
		labour: [
			{ name: "Carpenter", rate: 2500, hours: 14 },
			{ name: "Upholsterer", rate: 3000, hours: 16 },
			{ name: "Finisher", rate: 2200, hours: 3 },
			{ name: "Workshop assistant", rate: 1500, hours: 8 },
		],
		machines: [
			{ name: "Table saw", rate: 3500, hours: 3 },
			{ name: "Planer and thicknesser", rate: 2800, hours: 2 },
			{ name: "Industrial sewing machine", rate: 1200, hours: 6 },
			{ name: "Compressor and staple guns", rate: 1500, hours: 4 },
		],
	},
	{
		id: "table",
		name: "Coffee table",
		meta: "Tables · Walnut top, brass inlay",
		markup: 0.3,
		markupCap: 0.35,
		parts: [
			{
				name: "Walnut slab",
				detail: "Top · 6 available",
				spec: "120 × 60 × 4 cm",
				qty: 1,
				unit: 98000,
			},
			{
				name: "Brass inlay strip",
				detail: "Hardware · 36 m available",
				spec: "8 mm, per metre",
				qty: 4,
				unit: 4500,
			},
			{
				name: "Walnut hardwood",
				detail: "Base · 34 available",
				spec: '2" × 4", kiln-dried',
				qty: 2,
				unit: 18500,
			},
			{
				name: "Hardwax oil finish",
				detail: "Finishing · 13 tins available",
				spec: "Per piece",
				qty: 1,
				unit: 3000,
			},
		],
		labour: [
			{ name: "Carpenter", rate: 2500, hours: 6 },
			{ name: "Finisher", rate: 2200, hours: 3 },
			{ name: "Workshop assistant", rate: 1500, hours: 2 },
		],
		machines: [
			{ name: "Table saw", rate: 3500, hours: 2 },
			{ name: "Planer and thicknesser", rate: 2800, hours: 1 },
			{ name: "CNC router", rate: 12000, hours: 1 },
		],
	},
];

export type ProjectCost = {
	id: string;
	name: string;
	type: "Direct" | "Indirect";
	per: string;
	amount: number;
};

/** Costs charged once for the quote, which can be added from the Items step. */
export const PROJECT_COST_OPTIONS: Record<string, Omit<ProjectCost, "id">> = {
	site: {
		name: "Site visit and measurement",
		type: "Indirect",
		per: "Per project",
		amount: 10000,
	},
	out: { name: "Delivery outside Lagos", type: "Direct", per: "Per trip", amount: 80000 },
	third: { name: "Third-party work", type: "Direct", per: "Per project", amount: 0 },
	lagos: { name: "Delivery within Lagos", type: "Direct", per: "Per trip", amount: 25000 },
};

export const DEFAULT_PROJECT_COSTS: ProjectCost[] = [
	{
		id: "p-delivery",
		name: "Delivery within Lagos",
		type: "Direct",
		per: "Per trip",
		amount: 25000,
	},
	{
		id: "p-install",
		name: "Installation and assembly",
		type: "Direct",
		per: "Per visit",
		amount: 15000,
	},
];

// ─── What a draft holds ──────────────────────────────────────────────────────

export type QuoteDraft = {
	client: Client | null;
	/** Quantity per catalogue item id. */
	qty: Record<string, number>;
	/** Which item cards are expanded. */
	open: Record<string, boolean>;
	/** Parts taken off this quote, as "itemId|partName". */
	removedParts: string[];
	/** Hours changed from the item's default, as "itemId|hoursName". */
	hours: Record<string, number>;
	projectCosts: ProjectCost[];
	/** General discount, 0 to MAX_GENERAL_DISCOUNT. */
	discount: number;
	discountReason: string;
	currency: Currency;
};

export const emptyDraft = (): QuoteDraft => ({
	client: null,
	qty: Object.fromEntries(CATALOG.map((i) => [i.id, 1])),
	open: { [CATALOG[0].id]: true },
	removedParts: [],
	hours: {},
	projectCosts: DEFAULT_PROJECT_COSTS,
	discount: 0,
	discountReason: "",
	currency: "NGN",
});

// ─── Pricing ─────────────────────────────────────────────────────────────────

export type PricedHours = {
	key: string;
	name: string;
	hours: number;
	defaultHours: number;
	rate: number;
	cost: number;
};
export type PricedPart = CatalogPart & { key: string; line: number };
export type PricedItem = {
	id: string;
	name: string;
	meta: string;
	qty: number;
	markup: number;
	markupCap: number;
	parts: PricedPart[];
	labour: PricedHours[];
	machines: PricedHours[];
	partsCost: number;
	labourCost: number;
	machineCost: number;
	labourHours: number;
	machineHours: number;
	overhead: number;
	wrapping: number;
	/** Cost of one piece, before contingency. */
	unitCost: number;
	/** Cost of one piece including contingency. */
	unitCostWithContingency: number;
	/** What the client pays for these pieces, before VAT. */
	price: number;
};

export type Pricing = {
	items: PricedItem[];
	partsTotal: number;
	labourTotal: number;
	machineTotal: number;
	overheadTotal: number;
	/** Wrapping on every piece, plus the project costs. */
	otherTotal: number;
	projectTotal: number;
	contingency: number;
	totalCost: number;
	markup: number;
	/** Cost plus markup, before any discount. */
	beforeDiscount: number;
	discountPercent: number;
	discount: number;
	subtotal: number;
	vat: number;
	total: number;
	deposit: number;
	balance: number;
	/** The project costs with contingency, as one line on the client's quote. */
	projectLine: number;
};

export function priceQuote(draft: QuoteDraft): Pricing {
	const isTrade = draft.client?.type === "Trade";
	let partsTotal = 0,
		labourTotal = 0,
		machineTotal = 0,
		overheadTotal = 0,
		wrappingTotal = 0,
		markup = 0;

	const items = CATALOG.map((c): PricedItem => {
		const qty = draft.qty[c.id] ?? 1;
		const parts = c.parts
			.filter((p) => !draft.removedParts.includes(`${c.id}|${p.name}`))
			.map((p) => ({ ...p, key: `${c.id}|${p.name}`, line: p.qty * p.unit }));
		const hoursRows = (rows: CatalogHours[]) =>
			rows.map((r): PricedHours => {
				const key = `${c.id}|${r.name}`;
				const hours = draft.hours[key] ?? r.hours;
				return {
					key,
					name: r.name,
					hours,
					defaultHours: r.hours,
					rate: r.rate,
					cost: hours * r.rate,
				};
			});
		const labour = hoursRows(c.labour);
		const machines = hoursRows(c.machines);
		const sum = (rows: { cost: number }[]) => rows.reduce((a, r) => a + r.cost, 0);
		const partsCost = parts.reduce((a, p) => a + p.line, 0);
		const labourCost = sum(labour);
		const machineCost = sum(machines);
		const labourHours = labour.reduce((a, r) => a + r.hours, 0);
		const machineHours = machines.reduce((a, r) => a + r.hours, 0);
		const overhead = labourHours * OVERHEAD_PER_LABOUR_HOUR;
		const unitCost = partsCost + labourCost + machineCost + overhead + WRAPPING;
		const unitCostWithContingency = unitCost * (1 + CONTINGENCY);
		const price = unitCostWithContingency * (1 + c.markup) * qty;

		partsTotal += partsCost * qty;
		labourTotal += labourCost * qty;
		machineTotal += machineCost * qty;
		overheadTotal += overhead * qty;
		wrappingTotal += WRAPPING * qty;
		markup += unitCostWithContingency * qty * c.markup;

		return {
			id: c.id,
			name: c.name,
			meta: c.meta,
			qty,
			markup: c.markup,
			markupCap: c.markupCap,
			parts,
			labour,
			machines,
			partsCost,
			labourCost,
			machineCost,
			labourHours,
			machineHours,
			overhead,
			wrapping: WRAPPING,
			unitCost,
			unitCostWithContingency,
			price,
		};
	});

	const projectTotal = draft.projectCosts.reduce((a, c) => a + c.amount, 0);
	const base =
		partsTotal + labourTotal + machineTotal + overheadTotal + wrappingTotal + projectTotal;
	const contingency = base * CONTINGENCY;
	const totalCost = base + contingency;
	const beforeDiscount = totalCost + markup;
	// Trade clients get their tier discount only, never the general one on top
	const discountPercent = isTrade ? 0 : draft.discount;
	const discount = (beforeDiscount * discountPercent) / 100;
	const subtotal = beforeDiscount - discount;
	const vat = subtotal * VAT_RATE;
	const total = subtotal + vat;

	return {
		items,
		partsTotal,
		labourTotal,
		machineTotal,
		overheadTotal,
		otherTotal: wrappingTotal + projectTotal,
		projectTotal,
		contingency,
		totalCost,
		markup,
		beforeDiscount,
		discountPercent,
		discount,
		subtotal,
		vat,
		total,
		deposit: total * DEPOSIT_RATE,
		balance: total * (1 - DEPOSIT_RATE),
		projectLine: projectTotal * (1 + CONTINGENCY),
	};
}

// ─── Money ───────────────────────────────────────────────────────────────────

/** Naira rounded to a whole number, for rates and costs. */
export const wholeNaira = (n: number) =>
	`${DEFAULT_CURRENCY_SYMBOL}${Math.round(n).toLocaleString("en-NG")}`;

/** An amount (held in naira) in the chosen currency, with two decimals. */
export function formatMoney(naira: number, currency: Currency) {
	return currency === "USD"
		? `$${(naira / USD_RATE).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
		: `${DEFAULT_CURRENCY_SYMBOL}${naira.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Sample quote header ─────────────────────────────────────────────────────

/** TODO: real quote numbers, dates and validity come from the backend. */
export const DRAFT_NUMBER = "MAJ-QT-20261107-1432";
export const DRAFT_ISSUED = "7 Nov 2026";
export const DRAFT_VALID_UNTIL = "14 Nov 2026";
