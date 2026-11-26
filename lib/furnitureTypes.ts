import { hasPermission, type AppRole } from "@/lib/roles";

// ─── Types ───────────────────────────────────────────────────────────────────

/** A markup category from Pricing & margins. Rates are fractions (0.35 = 35%). */
export type FurnitureCategory = {
	id: string;
	name: string;
	/** Default markup. 0 when the viewer can't see prices. */
	markup: number;
	/** The most the markup can be raised to on a quote. */
	cap: number;
};

export type FurnitureTypeStatus = "draft" | "published";

export type FurnitureTypeSummary = {
	id: string;
	name: string;
	categoryId: string;
	/** The category's name, for display. */
	category: string;
	status: FurnitureTypeStatus;
};

/** A part from inventory as costing sees it. */
export type InventoryPart = {
	sku: string;
	name: string;
	spec: string;
	/** Singular unit, e.g. "piece", "sheet", "m". */
	unit: string;
	/** Naira per unit. 0 when the viewer can't see prices. */
	unitCost: number;
	category: string;
	/** In stock less what's reserved for job cards. */
	available: number;
};

export type TemplatePart = { sku: string; qty: number };
/** Hours on one piece; `rate` is resolved from Staff or Machines, never stored with the template. */
export type HoursRow = { name: string; rate: number; hours: number };
export type ExtraCost = {
	name: string;
	type: "Direct" | "Indirect";
	amount: number;
	costItemId?: string | null;
};

/** The standard parts, hours and costs for one piece of a furniture type. */
export type FurnitureTemplate = {
	typeId: string;
	description: string;
	/** Photo URLs, cover first. Empty until photo upload is connected. */
	photos: string[];
	parts: TemplatePart[];
	labour: HoursRow[];
	machines: HoursRow[];
	extras: ExtraCost[];
	buildNotes: string;
	leadTime: string;
	standardSize: string;
	cratePieces: number;
};

/** Rates templates are costed with, from Staff, Machines and Cost rates. */
export type CostingRates = {
	/** Workshop overhead per production labour hour, from Cost rates. */
	overheadPerLabourHour: number;
	/** Contingency as a fraction, from Cost rates. */
	contingency: number;
	/** Average hourly rate per production role, from Staff. */
	labourRates: Record<string, number>;
	/** Hourly cost per machine, from Machines. */
	machineRates: Record<string, number>;
};

/** A standard cost (from Cost rates) that can be added to a type or a quote. */
export type OtherCostOption = ExtraCost & { id: string; note: string; per: string };

export type FurnitureCatalog = {
	categories: FurnitureCategory[];
	types: FurnitureTypeSummary[];
	templates: Record<string, FurnitureTemplate>;
	inventory: InventoryPart[];
	rates: CostingRates;
};

export const NO_RATES: CostingRates = {
	overheadPerLabourHour: 0,
	contingency: 0,
	labourRates: {},
	machineRates: {},
};

// ─── Role access ─────────────────────────────────────────────────────────────

export type FurnitureAccess = {
	/** Name, category, description, photos, publishing and new types. */
	canEditDetails: boolean;
	/** Standard parts, quantities, hours and build notes. */
	canEditParts: boolean;
	/** Other costs per piece. Needs prices, so not production. */
	canEditCosts: boolean;
	/** Delete a furniture type (`templates.delete`). */
	canDelete: boolean;
	/** Unit costs, line costs and prices. Hidden from production. */
	showCost: boolean;
	/** Can add a markup category while creating a type (Pricing & margins editors). */
	canAddCategory: boolean;
	banner?: string;
};

/**
 * Follows the database: `templates.edit` adds and changes templates, `templates.delete`
 * removes them, `quotes.view_prices` sees (and so edits) costs.
 */
export function furnitureAccess(role: AppRole): FurnitureAccess {
	const edit = hasPermission(role, "templates.edit");
	const showCost = hasPermission(role, "quotes.view_prices");
	const access: FurnitureAccess = {
		canEditDetails: edit,
		canEditParts: edit,
		canEditCosts: edit && showCost,
		canDelete: hasPermission(role, "templates.delete"),
		showCost,
		canAddCategory: hasPermission(role, "pricing_rules.edit"),
	};
	if (!edit) {
		access.banner = "View only. Ask production, procurement or the MD/GM to change a template.";
	} else if (!showCost) {
		access.banner = "Costs and prices are hidden for production.";
	}
	return access;
}

// ─── Grouping ────────────────────────────────────────────────────────────────

export type FurnitureGroup = { category: FurnitureCategory; types: FurnitureTypeSummary[] };

/** Types grouped under their category, in the categories' order. Empty categories are left out. */
export function groupTypes(
	types: FurnitureTypeSummary[],
	categories: FurnitureCategory[],
): FurnitureGroup[] {
	return categories
		.map((category) => ({
			category,
			types: types
				.filter((t) => t.categoryId === category.id)
				.sort((a, b) => a.name.localeCompare(b.name)),
		}))
		.filter((g) => g.types.length > 0);
}

// ─── Costing ─────────────────────────────────────────────────────────────────

export type TemplateCost = {
	parts: number;
	labourHours: number;
	labour: number;
	machineHours: number;
	machines: number;
	overhead: number;
	extras: number;
	contingency: number;
	/** Cost of one piece including contingency. */
	standard: number;
	markup: number;
	/** Price of one piece before VAT. */
	price: number;
};

export function costTemplate(
	template: Pick<FurnitureTemplate, "parts" | "labour" | "machines" | "extras">,
	inventory: InventoryPart[],
	markupRate: number,
	rates: Pick<CostingRates, "overheadPerLabourHour" | "contingency">,
): TemplateCost {
	const bySku = new Map(inventory.map((p) => [p.sku, p]));
	const parts = template.parts.reduce(
		(sum, p) => sum + p.qty * (bySku.get(p.sku)?.unitCost ?? 0),
		0,
	);
	const total = (rows: HoursRow[]) => rows.reduce((sum, r) => sum + r.hours * r.rate, 0);
	const hours = (rows: HoursRow[]) => rows.reduce((sum, r) => sum + r.hours, 0);

	const labourHours = hours(template.labour);
	const labour = total(template.labour);
	const machineHours = hours(template.machines);
	const machines = total(template.machines);
	const overhead = labourHours * rates.overheadPerLabourHour;
	const extras = template.extras.reduce((sum, e) => sum + e.amount, 0);

	const subtotal = parts + labour + machines + overhead + extras;
	const contingency = subtotal * rates.contingency;
	const standard = subtotal + contingency;
	return {
		parts,
		labourHours,
		labour,
		machineHours,
		machines,
		overhead,
		extras,
		contingency,
		standard,
		markup: standard * markupRate,
		price: standard * (1 + markupRate),
	};
}

export const percent = (rate: number) => `${Math.round(rate * 1000) / 10}%`;

/** A category id from its name, e.g. "Dining tables" → "dining-tables". */
export const categoryIdFor = (name: string) =>
	name
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
