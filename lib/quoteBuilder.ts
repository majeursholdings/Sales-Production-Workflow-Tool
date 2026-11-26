import dayjs from "dayjs";
import { DEFAULT_CURRENCY_SYMBOL } from "@/lib/currency";
import type { Client } from "@/lib/clients";
import type { FurnitureCatalog } from "@/lib/furnitureTypes";

// ─── Fallbacks ───────────────────────────────────────────────────────────────

/**
 * Used only when `public.pricing_rules` has no row. The real values are set in
 * Pricing & margins / Settings and read on the server (lib/data/quoteBuilder.ts).
 */
export const USD_RATE = 1460;
export const DEPOSIT_RATE = 0.7;
export const VALID_DAYS = 7;
export const MAX_GENERAL_DISCOUNT = 3;

export type Currency = "NGN" | "USD";

// ─── Rates and catalogue ─────────────────────────────────────────────────────

/** Everything a quote is priced with, from Pricing & margins and Cost rates. Rates are fractions. */
export type BuilderRates = {
	vatRate: number;
	depositRate: number;
	validDays: number;
	/** Most a general discount can be, as a whole percentage. */
	maxDiscount: number;
	/** Naira per US dollar. */
	usdRate: number;
	contingency: number;
	overheadPerLabourHour: number;
};

type CatalogPart = {
	sku: string;
	name: string;
	/** e.g. "Timber · 34 available". */
	detail: string;
	spec: string;
	qty: number;
	unit: number;
};
type CatalogHours = { name: string; rate: number; hours: number };

/** A published furniture type, ready to add to a quote. */
export type CatalogItem = {
	id: string;
	name: string;
	category: string;
	description: string;
	markup: number;
	markupCap: number;
	parts: CatalogPart[];
	labour: CatalogHours[];
	machines: CatalogHours[];
	/** Other costs on every piece, e.g. protective wrapping. */
	extras: { name: string; amount: number }[];
};

/** The quote builder's catalogue: every published furniture type with its template. */
export function toCatalog(catalog: FurnitureCatalog): CatalogItem[] {
	const bySku = new Map(catalog.inventory.map((p) => [p.sku, p]));
	const byCategory = new Map(catalog.categories.map((c) => [c.id, c]));
	return catalog.types
		.filter((t) => t.status === "published" && catalog.templates[t.id])
		.map((t) => {
			const template = catalog.templates[t.id];
			const category = byCategory.get(t.categoryId);
			return {
				id: t.id,
				name: t.name,
				category: t.category,
				description: template.description,
				markup: category?.markup ?? 0,
				markupCap: category?.cap ?? 0,
				parts: template.parts.flatMap((p) => {
					const part = bySku.get(p.sku);
					if (!part) return [];
					return [
						{
							sku: p.sku,
							name: part.name,
							detail: `${part.category} · ${part.available} ${part.unit} available`,
							spec: part.spec,
							qty: p.qty,
							unit: part.unitCost,
						},
					];
				}),
				labour: template.labour,
				machines: template.machines,
				extras: template.extras.map((e) => ({ name: e.name, amount: e.amount })),
			};
		})
		.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}

export type ProjectCost = {
	id: string;
	name: string;
	type: "Direct" | "Indirect";
	per: string;
	amount: number;
};

/** Number, issue date and validity shown on a quote before it's saved. */
export type QuoteHeader = { number: string; issued: string; validUntil: string };

export type QuoteBuilderSetup = {
	catalog: CatalogItem[];
	rates: BuilderRates;
	/** Standard costs from Cost rates that can be added once per quote. */
	projectCostOptions: ProjectCost[];
	header: QuoteHeader;
};

// ─── Quote numbers and dates ─────────────────────────────────────────────────

export const quoteDatePrefix = (day = dayjs(), prefix = "MAJ-QT-") =>
	`${prefix}${day.format("YYYYMMDD")}-`;

/** The next free number for the day, e.g. MAJ-QT-20261125-0003, given the day's numbers already used. */
export function nextQuoteNumber(taken: string[], day = dayjs(), docPrefix = "MAJ-QT-") {
	const prefix = quoteDatePrefix(day, docPrefix);
	const highest = taken
		.filter((n) => n.startsWith(prefix))
		.map((n) => Number(n.slice(prefix.length)))
		.filter(Number.isFinite)
		.reduce((max, n) => Math.max(max, n), 0);
	return `${prefix}${String(highest + 1).padStart(4, "0")}`;
}

export const quoteDateLabel = (date: string | dayjs.Dayjs) => dayjs(date).format("D MMM YYYY");

// ─── What a draft holds ──────────────────────────────────────────────────────

export type QuoteDraft = {
	/** Set once the quote is saved; later saves update it. */
	quoteNumber: string | null;
	/** Issue and validity dates of the saved quote. */
	savedHeader: QuoteHeader | null;
	sent: boolean;
	client: Client | null;
	/** Furniture type ids on the quote, in the order added. */
	items: string[];
	/** Quantity per furniture type id. */
	qty: Record<string, number>;
	/** Which item cards are expanded. */
	open: Record<string, boolean>;
	/** Parts taken off this quote, as "typeId|sku". */
	removedParts: string[];
	/** Hours changed from the item's default, as "typeId|kind|name". */
	hours: Record<string, number>;
	projectCosts: ProjectCost[];
	/** General discount, 0 to the max in Pricing & margins. */
	discount: number;
	discountReason: string;
	currency: Currency;
};

export const emptyDraft = (): QuoteDraft => ({
	quoteNumber: null,
	savedHeader: null,
	sent: false,
	client: null,
	items: [],
	qty: {},
	open: {},
	removedParts: [],
	hours: {},
	projectCosts: [],
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
	category: string;
	description: string;
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
	extras: { name: string; amount: number }[];
	/** Other costs on one piece. */
	extrasCost: number;
	/** Cost of one piece, before contingency. */
	unitCost: number;
	/** Cost of one piece including contingency. */
	unitCostWithContingency: number;
	/** What the client pays for these pieces, before discount and VAT. */
	price: number;
};

export type Pricing = {
	items: PricedItem[];
	/** Furniture type ids on the draft that aren't in the catalogue any more. */
	missing: string[];
	partsTotal: number;
	labourTotal: number;
	machineTotal: number;
	overheadTotal: number;
	/** Other costs on every piece, plus the project costs. */
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

type DraftForPricing = Pick<
	QuoteDraft,
	"client" | "items" | "qty" | "removedParts" | "hours" | "projectCosts" | "discount"
>;

export function priceQuote(
	draft: DraftForPricing,
	catalog: CatalogItem[],
	rates: BuilderRates,
): Pricing {
	const isTrade = draft.client?.type === "Trade";
	const byId = new Map(catalog.map((c) => [c.id, c]));
	let partsTotal = 0,
		labourTotal = 0,
		machineTotal = 0,
		overheadTotal = 0,
		extrasTotal = 0,
		markup = 0;

	const missing = draft.items.filter((id) => !byId.has(id));
	const items = draft.items.flatMap((id): PricedItem[] => {
		const c = byId.get(id);
		if (!c) return [];
		const qty = Math.max(1, draft.qty[c.id] ?? 1);
		const parts = c.parts
			.filter((p) => !draft.removedParts.includes(`${c.id}|${p.sku}`))
			.map((p) => ({ ...p, key: `${c.id}|${p.sku}`, line: p.qty * p.unit }));
		const hoursRows = (kind: "labour" | "machine", rows: CatalogHours[]) =>
			rows.map((r): PricedHours => {
				const key = `${c.id}|${kind}|${r.name}`;
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
		const labour = hoursRows("labour", c.labour);
		const machines = hoursRows("machine", c.machines);
		const sum = (rows: { cost: number }[]) => rows.reduce((a, r) => a + r.cost, 0);
		const partsCost = parts.reduce((a, p) => a + p.line, 0);
		const labourCost = sum(labour);
		const machineCost = sum(machines);
		const labourHours = labour.reduce((a, r) => a + r.hours, 0);
		const machineHours = machines.reduce((a, r) => a + r.hours, 0);
		const overhead = labourHours * rates.overheadPerLabourHour;
		const extrasCost = c.extras.reduce((a, e) => a + e.amount, 0);
		const unitCost = partsCost + labourCost + machineCost + overhead + extrasCost;
		const unitCostWithContingency = unitCost * (1 + rates.contingency);
		const price = unitCostWithContingency * (1 + c.markup) * qty;

		partsTotal += partsCost * qty;
		labourTotal += labourCost * qty;
		machineTotal += machineCost * qty;
		overheadTotal += overhead * qty;
		extrasTotal += extrasCost * qty;
		markup += unitCostWithContingency * qty * c.markup;

		return [
			{
				id: c.id,
				name: c.name,
				category: c.category,
				description: c.description,
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
				extras: c.extras,
				extrasCost,
				unitCost,
				unitCostWithContingency,
				price,
			},
		];
	});

	const projectTotal = draft.projectCosts.reduce((a, c) => a + c.amount, 0);
	const base =
		partsTotal + labourTotal + machineTotal + overheadTotal + extrasTotal + projectTotal;
	const contingency = base * rates.contingency;
	const totalCost = base + contingency;
	const beforeDiscount = totalCost + markup;
	// Trade clients get their tier discount only, never the general one on top
	const discountPercent = isTrade ? 0 : Math.min(draft.discount, rates.maxDiscount);
	const discount = (beforeDiscount * discountPercent) / 100;
	const subtotal = beforeDiscount - discount;
	const vat = subtotal * rates.vatRate;
	const total = subtotal + vat;

	return {
		items,
		missing,
		partsTotal,
		labourTotal,
		machineTotal,
		overheadTotal,
		otherTotal: extrasTotal + projectTotal,
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
		deposit: total * rates.depositRate,
		balance: total * (1 - rates.depositRate),
		projectLine: projectTotal * (1 + rates.contingency),
	};
}

export const PROJECT_LINE_NAME = "Delivery, installation and project costs";

/**
 * The lines the client sees, with the general discount spread over every line so
 * the lines add up to the subtotal (VAT goes on top).
 */
export function clientLines(pricing: Pricing, projectCosts: ProjectCost[]) {
	const keep = 1 - pricing.discountPercent / 100;
	const lines = pricing.items.map((i) => ({
		name: i.name,
		description: i.description,
		qty: i.qty,
		unitPrice: (i.price / i.qty) * keep,
	}));
	if (pricing.projectLine > 0) {
		lines.push({
			name: PROJECT_LINE_NAME,
			description: projectCosts.map((c) => c.name).join(", "),
			qty: 1,
			unitPrice: pricing.projectLine * keep,
		});
	}
	return lines;
}

// ─── Money ───────────────────────────────────────────────────────────────────

/** Naira rounded to a whole number, for rates and costs. */
export const wholeNaira = (n: number) =>
	`${DEFAULT_CURRENCY_SYMBOL}${Math.round(n).toLocaleString("en-NG")}`;

/** An amount (held in naira) in the chosen currency, with two decimals. */
export function formatMoney(naira: number, currency: Currency, usdRate: number) {
	return currency === "USD"
		? `$${(naira / usdRate).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
		: `${DEFAULT_CURRENCY_SYMBOL}${naira.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export const ratePercent = (rate: number) => `${Math.round(rate * 1000) / 10}%`;
