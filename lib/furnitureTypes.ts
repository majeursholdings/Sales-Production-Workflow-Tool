import type { AppRole } from "@/lib/roles";

// ─── Types ───────────────────────────────────────────────────────────────────

export type FurnitureCategory = "Sofas" | "Tables" | "Beds" | "Chairs" | "Storage" | "Office";

export const FURNITURE_CATEGORIES: FurnitureCategory[] = [
	"Sofas",
	"Tables",
	"Beds",
	"Chairs",
	"Storage",
	"Office",
];

/** Default markup and the most customer care can raise it to on a quote, from Pricing & margins. */
export const CATEGORY_MARKUP: Record<FurnitureCategory, { markup: number; cap: number }> = {
	Sofas: { markup: 0.35, cap: 0.4 },
	Tables: { markup: 0.3, cap: 0.35 },
	Beds: { markup: 0.32, cap: 0.38 },
	Chairs: { markup: 0.28, cap: 0.33 },
	Storage: { markup: 0.3, cap: 0.35 },
	Office: { markup: 0.25, cap: 0.3 },
};

export type FurnitureTypeSummary = {
	id: string;
	name: string;
	category: FurnitureCategory;
};

export type InventoryPart = {
	sku: string;
	name: string;
	spec: string;
	/** Singular unit, e.g. "piece", "sheet", "m". */
	unit: string;
	unitCost: number;
	category: "Timber" | "Upholstery" | "Seating" | "Hardware" | "Finishing";
	stock: string;
};

export const INVENTORY_CATEGORIES = [
	"Timber",
	"Upholstery",
	"Seating",
	"Hardware",
	"Finishing",
] as const;

export type TemplatePart = { sku: string; qty: number };
export type HoursRow = { name: string; rate: number; hours: number };
export type ExtraCost = { name: string; type: "Direct" | "Indirect"; amount: number };

/** The standard parts, hours and costs for one piece of a furniture type. */
export type FurnitureTemplate = {
	typeId: string;
	description: string;
	photoCount: number;
	parts: TemplatePart[];
	labour: HoursRow[];
	machines: HoursRow[];
	extras: ExtraCost[];
	buildNotes: string;
};

// ─── Rates and constants ─────────────────────────────────────────────────────

/** Workshop overhead charged for each production labour hour, from Cost rates. */
export const OVERHEAD_PER_LABOUR_HOUR = 3673;
export const CONTINGENCY = 0.05;

/** Roles in the furniture catalogue's labour list, with their average hourly rate from Staff. */
export const LABOUR_RATES: Record<string, number> = {
	Carpenter: 2500,
	Upholsterer: 3000,
	Finisher: 2200,
	"Metal worker": 2800,
	"Workshop assistant": 1500,
	"Production lead": 3500,
};

/** Machines, with their hourly cost from Machines. */
export const MACHINE_RATES: Record<string, number> = {
	"Table saw": 3500,
	"Planer and thicknesser": 2800,
	"CNC router": 12000,
	"Band saw": 2000,
	"Industrial sewing machine": 1200,
	"Compressor and staple guns": 1500,
	"Spray booth": 4500,
	"Edge bander": 3000,
};

/** One-off costs that can be added to a type, with their usual amounts (0 = enter an amount). */
export const OTHER_COST_OPTIONS: (ExtraCost & { note: string })[] = [
	{
		name: "Protective wrapping",
		type: "Direct",
		amount: 4000,
		note: "Blankets and stretch film",
	},
	{
		name: "Crating for long-distance delivery",
		type: "Direct",
		amount: 18000,
		note: "Timber crate for deliveries outside Lagos",
	},
	{
		name: "Installation and assembly",
		type: "Direct",
		amount: 15000,
		note: "Fitting at the client's site",
	},
	{
		name: "Third-party work",
		type: "Direct",
		amount: 0,
		note: "Glass, stone, metal or upholstery done outside",
	},
];

// ─── Role access ─────────────────────────────────────────────────────────────

export type FurnitureAccess = {
	/** Name, category, description, new types, other costs. */
	canEditDetails: boolean;
	/** Standard parts, quantities, hours and build notes. */
	canEditParts: boolean;
	/** Unit costs, line costs and prices. Hidden from production. */
	showCost: boolean;
	banner?: string;
};

export function furnitureAccess(role: AppRole): FurnitureAccess {
	const details = role === "md" || role === "gm" || role === "procurement";
	if (details) return { canEditDetails: true, canEditParts: true, showCost: true };
	if (role === "production") {
		return {
			canEditDetails: false,
			canEditParts: true,
			showCost: false,
			banner: "You can change standard parts, quantities and build notes. Costs and prices are hidden for production.",
		};
	}
	return {
		canEditDetails: false,
		canEditParts: false,
		showCost: true,
		banner: "View only. Ask procurement or production to change a template.",
	};
}

// ─── Sample data ─────────────────────────────────────────────────────────────

const part = (
	sku: string,
	name: string,
	spec: string,
	unit: string,
	unitCost: number,
	category: InventoryPart["category"],
	stock: string,
): InventoryPart => ({ sku, name, spec, unit, unitCost, category, stock });

/**
 * TODO: replace with real furniture types and inventory once there's a backend.
 * The sample catalogue from the design. Pages read it only through the
 * functions below, so swapping in real data is a one-file change.
 */
const INVENTORY: InventoryPart[] = [
	part(
		"TMB-WAL-24",
		"Walnut hardwood",
		'2" × 4", kiln-dried',
		"piece",
		18500,
		"Timber",
		"34 available",
	),
	part(
		"UPH-FOAM-40",
		"High-density foam 40D",
		'6" sheet',
		"sheet",
		32000,
		"Upholstery",
		"6 available",
	),
	part(
		"UPH-BCL-OAT",
		"Bouclé fabric, oat",
		"Per yard",
		"yard",
		9800,
		"Upholstery",
		"46 available",
	),
	part("SEA-PKT-3S", "Pocket spring unit", "3-seat set", "set", 45000, "Seating", "4 available"),
	part(
		"HDW-LEG-BR6",
		"Tapered brass legs",
		'6", set screw',
		"piece",
		6500,
		"Hardware",
		"28 available",
	),
	part(
		"UPH-WEB-50",
		"Elastic webbing",
		"50 mm, per metre",
		"m",
		1200,
		"Upholstery",
		"120 m available",
	),
	part(
		"HDW-CAP-BR",
		"Brass corner caps",
		"25 mm, satin",
		"piece",
		2800,
		"Hardware",
		"0 available",
	),
	part("FIN-HWX-1L", "Hardwax oil finish", "1 L tin", "tin", 3000, "Finishing", "13 available"),
	part("UPH-DAC-1", "Dacron wrap", "Per metre", "m", 1500, "Upholstery", "60 m available"),
	part(
		"TMB-WAL-VEN",
		"Walnut veneer board",
		"2440 × 1220 mm",
		"board",
		64000,
		"Timber",
		"9 available",
	),
	part(
		"UPH-CORD-NAT",
		"Woven paper cord",
		"Natural, 3 mm",
		"m",
		1800,
		"Upholstery",
		"0 available",
	),
];

const GROUPS: { category: FurnitureCategory; types: [string, string][] }[] = [
	{
		category: "Sofas",
		types: [
			["sofa3", "3-seater sofa"],
			["sofa2", "2-seater loveseat"],
			["armchair", "Armchair"],
		],
	},
	{
		category: "Tables",
		types: [
			["coffee", "Coffee table"],
			["dining8", "Dining table, seats 8"],
			["side", "Side table"],
		],
	},
	{ category: "Beds", types: [["king", "King bed frame"]] },
	{
		category: "Chairs",
		types: [
			["dchair", "Dining chair"],
			["lounge", "Lounge chair"],
		],
	},
	{ category: "Storage", types: [["wardrobe", "3-door wardrobe"]] },
	{ category: "Office", types: [["desk", "Office desk"]] },
];

const SOFA_TEMPLATE: Omit<FurnitureTemplate, "typeId"> = {
	description: "Walnut hardwood frame, pocket-spring seat, tapered brass legs",
	photoCount: 3,
	parts: [
		{ sku: "TMB-WAL-24", qty: 12 },
		{ sku: "UPH-FOAM-40", qty: 3 },
		{ sku: "UPH-BCL-OAT", qty: 14 },
		{ sku: "SEA-PKT-3S", qty: 1 },
		{ sku: "HDW-LEG-BR6", qty: 4 },
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
	extras: [{ name: "Protective wrapping", type: "Direct", amount: 4000 }],
	buildNotes:
		'Frame: mortise-and-tenon joints, glued and screwed; seat rails 2" × 4". Arms detachable for deliveries through doors under 90 cm. Legs fixed with set screws after upholstery.',
};

export async function getFurnitureTypeGroups() {
	return GROUPS.map(({ category, types }) => ({
		category,
		types: types.map(([id, name]): FurnitureTypeSummary => ({ id, name, category })),
	}));
}

export async function getInventoryParts(): Promise<InventoryPart[]> {
	return INVENTORY;
}

/**
 * The design only itemises the 3-seater sofa, so every type gets that template for now.
 * TODO: give each type its own parts and hours.
 */
export async function getFurnitureTemplates(): Promise<Record<string, FurnitureTemplate>> {
	return Object.fromEntries(
		GROUPS.flatMap((g) => g.types).map(([id, name]) => [
			id,
			{
				...SOFA_TEMPLATE,
				typeId: id,
				description: id === "sofa3" ? SOFA_TEMPLATE.description : `${name}, standard build`,
			},
		]),
	);
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
	const overhead = labourHours * OVERHEAD_PER_LABOUR_HOUR;
	const extras = template.extras.reduce((sum, e) => sum + e.amount, 0);

	const subtotal = parts + labour + machines + overhead + extras;
	const contingency = subtotal * CONTINGENCY;
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

export const percent = (rate: number) => `${Math.round(rate * 100)}%`;
