import type {
	CostingRates,
	ExtraCost,
	FurnitureCatalog,
	FurnitureCategory,
	FurnitureTemplate,
	FurnitureTypeStatus,
	FurnitureTypeSummary,
	HoursRow,
	InventoryPart,
	OtherCostOption,
} from "@/lib/furnitureTypes";
import { getCostItems } from "@/lib/data/costRates";
import { createClient } from "@/utils/supabase/server";

type Num = number | string | null;

/** What `public.furniture_costing()` returns. Costs are null for viewers without prices. */
type CostingRow = {
	can_see_costs: boolean;
	categories: { id: string; name: string; markup: Num; ceiling: Num }[];
	parts: {
		sku: string;
		name: string;
		spec: string;
		unit: string;
		category: string;
		unit_cost: Num;
		available: Num;
	}[];
	labour_rates: { name: string; rate: Num }[];
	machine_rates: { name: string; rate: Num }[];
	overhead_per_labour_hour: Num;
	contingency_percent: Num;
};

type TypeRow = {
	id: string;
	name: string;
	category_id: string;
	description: string;
	build_notes: string;
	lead_time: string;
	standard_size: string;
	crate_pieces: Num;
	status: FurnitureTypeStatus;
	photo_urls: string[] | null;
	furniture_type_parts: { sku: string; qty: Num; sort_order: Num }[];
	furniture_type_hours: { kind: "labour" | "machine"; name: string; hours: Num; sort_order: Num }[];
	furniture_type_extras: {
		name: string;
		cost_type: ExtraCost["type"];
		amount: Num;
		cost_item_id: string | null;
		sort_order: Num;
	}[];
};

const TYPE_COLUMNS =
	"id, name, category_id, description, build_notes, lead_time, standard_size, crate_pieces, status, photo_urls, furniture_type_parts(sku, qty, sort_order), furniture_type_hours(kind, name, hours, sort_order), furniture_type_extras(name, cost_type, amount, cost_item_id, sort_order)";

const num = (v: Num) => Number(v ?? 0);
const bySort = <T extends { sort_order: Num }>(rows: T[]) =>
	[...rows].sort((a, b) => num(a.sort_order) - num(b.sort_order));
const rateMap = (rows: { name: string; rate: Num }[]) =>
	Object.fromEntries(rows.map((r) => [r.name, num(r.rate)]));

async function getCosting() {
	const supabase = await createClient();
	const { data, error } = await supabase.rpc("furniture_costing");
	if (error) throw new Error(`Failed to load furniture costing: ${error.message}`);
	const row = data as CostingRow;

	const categories: FurnitureCategory[] = row.categories.map((c) => ({
		id: c.id,
		name: c.name,
		markup: num(c.markup) / 100,
		cap: num(c.ceiling) / 100,
	}));
	const inventory: InventoryPart[] = row.parts.map((p) => ({
		sku: p.sku,
		name: p.name,
		spec: p.spec,
		unit: p.unit,
		category: p.category,
		unitCost: num(p.unit_cost),
		available: num(p.available),
	}));
	const rates: CostingRates = {
		overheadPerLabourHour: num(row.overhead_per_labour_hour),
		contingency: num(row.contingency_percent) / 100,
		labourRates: rateMap(row.labour_rates),
		machineRates: rateMap(row.machine_rates),
	};
	return { categories, inventory, rates };
}

const toTemplate = (row: TypeRow, rates: CostingRates): FurnitureTemplate => {
	const hours = bySort(row.furniture_type_hours);
	const rows = (kind: "labour" | "machine", table: Record<string, number>): HoursRow[] =>
		hours
			.filter((h) => h.kind === kind)
			.map((h) => ({ name: h.name, hours: num(h.hours), rate: table[h.name] ?? 0 }));
	return {
		typeId: row.id,
		description: row.description,
		photos: row.photo_urls ?? [],
		parts: bySort(row.furniture_type_parts).map((p) => ({ sku: p.sku, qty: num(p.qty) })),
		labour: rows("labour", rates.labourRates),
		machines: rows("machine", rates.machineRates),
		extras: bySort(row.furniture_type_extras).map((e) => ({
			name: e.name,
			type: e.cost_type,
			amount: num(e.amount),
			costItemId: e.cost_item_id,
		})),
		buildNotes: row.build_notes,
		leadTime: row.lead_time,
		standardSize: row.standard_size,
		cratePieces: num(row.crate_pieces) || 1,
	};
};

/**
 * Every furniture type the viewer can see (drafts only for template editors, via RLS),
 * with its template costed at today's rates. `publishedOnly` is for the quote builder.
 */
export async function getFurnitureCatalog(
	{ publishedOnly = false }: { publishedOnly?: boolean } = {},
): Promise<FurnitureCatalog> {
	const supabase = await createClient();
	let query = supabase.from("furniture_types").select(TYPE_COLUMNS).order("name");
	if (publishedOnly) query = query.eq("status", "published");

	const [{ categories, inventory, rates }, { data, error }] = await Promise.all([
		getCosting(),
		query,
	]);
	if (error) throw new Error(`Failed to load furniture types: ${error.message}`);

	const rows = (data ?? []) as unknown as TypeRow[];
	const categoryName = new Map(categories.map((c) => [c.id, c.name]));
	const types: FurnitureTypeSummary[] = rows.map((r) => ({
		id: r.id,
		name: r.name,
		categoryId: r.category_id,
		category: categoryName.get(r.category_id) ?? r.category_id,
		status: r.status,
	}));

	return {
		categories,
		types,
		templates: Object.fromEntries(rows.map((r) => [r.id, toTemplate(r, rates)])),
		inventory,
		rates,
	};
}

/** Categories and inventory only, for the new furniture type form. */
export async function getFurnitureCosting() {
	return getCosting();
}

/** Standard costs from Cost rates. Viewers who can't read them (RLS) get an empty list. */
export async function getOtherCostOptions(): Promise<OtherCostOption[]> {
	const items = await getCostItems();
	return items.map((item) => ({ ...item, costItemId: item.id }));
}
