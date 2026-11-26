import {
	declineLabel,
	type CostRequest,
	type RequestPart,
	type Resolution,
} from "@/lib/costRequests";
import { createClient } from "@/utils/supabase/server";

type Num = number | string;

type SubstituteRow = {
	id: string;
	position: number;
	name: string;
	sku: string;
	qty: Num;
	unit_cost: Num;
	why: string;
};

type PartRow = {
	id: string;
	position: number;
	name: string;
	sku: string | null;
	use: string;
	qty: Num;
	unit_cost: Num;
	confidence: number;
	kind: RequestPart["kind"];
	note: string | null;
	pin_x: Num | null;
	pin_y: Num | null;
	doubt: string | null;
	asked_to_add: boolean;
	suggested_unit_cost: Num | null;
	suggested_supplier_id: string | null;
	suggested_lead_days: number | null;
	resolution: Resolution["kind"] | null;
	substitute_id: string | null;
	one_off_unit_cost: Num | null;
	one_off_supplier_id: string | null;
	one_off_lead_days: number | null;
	add_to_inventory: boolean;
	cost_request_substitutes: SubstituteRow[];
};

type RequestRow = {
	id: string;
	title: string;
	target: string;
	new_piece: boolean;
	client_name: string;
	quote_number: string;
	requested_by: string | null;
	requested_by_name: string;
	requested_at: string;
	needed_by: string;
	size: string;
	quantity: number;
	markup_percent: Num;
	markup_category: string;
	notes: string;
	status: CostRequest["status"];
	decline_reason: string | null;
	alternative: string | null;
	save_as_type: boolean;
	approved_by_name: string | null;
	approved_cost: Num | null;
	cost_request_images: { position: number; src: string; alt: string }[];
	cost_request_parts: PartRow[];
	cost_request_messages: {
		id: number;
		author_id: string | null;
		author_name: string;
		body: string;
		created_at: string;
	}[];
};

const COLUMNS = `id, title, target, new_piece, client_name, quote_number, requested_by,
	requested_by_name, requested_at, needed_by, size, quantity, markup_percent, markup_category,
	notes, status, decline_reason, alternative, save_as_type, approved_by_name, approved_cost,
	cost_request_images(position, src, alt),
	cost_request_parts(id, position, name, sku, use, qty, unit_cost, confidence, kind, note,
		pin_x, pin_y, doubt, asked_to_add, suggested_unit_cost, suggested_supplier_id,
		suggested_lead_days, resolution, substitute_id, one_off_unit_cost, one_off_supplier_id,
		one_off_lead_days, add_to_inventory,
		cost_request_substitutes!cost_request_substitutes_part_id_fkey(id, position, name, sku, qty, unit_cost, why)),
	cost_request_messages(id, author_id, author_name, body, created_at)`;

const byPosition = (a: { position: number }, b: { position: number }) => a.position - b.position;

function resolutionOf(row: PartRow): Resolution | null {
	switch (row.resolution) {
		case "keep":
		case "drop":
			return { kind: row.resolution };
		case "sub":
			return row.substitute_id ? { kind: "sub", id: row.substitute_id } : null;
		case "oneOff":
			return {
				kind: "oneOff",
				unitCost: Number(row.one_off_unit_cost ?? 0),
				supplierId: row.one_off_supplier_id ?? "",
				leadDays: row.one_off_lead_days ?? 0,
				addToInventory: row.add_to_inventory,
			};
		default:
			return null;
	}
}

const toPart = (row: PartRow): RequestPart => ({
	id: row.id,
	name: row.name,
	sku: row.sku,
	use: row.use,
	qty: Number(row.qty),
	unitCost: Number(row.unit_cost),
	confidence: row.confidence,
	kind: row.kind,
	note: row.note ?? undefined,
	pin: row.pin_x === null || row.pin_y === null ? null : [Number(row.pin_x), Number(row.pin_y)],
	doubt: row.doubt ?? undefined,
	askedToAdd: row.asked_to_add,
	suggestion:
		row.suggested_unit_cost === null
			? undefined
			: {
					unitCost: Number(row.suggested_unit_cost),
					supplierId: row.suggested_supplier_id ?? "",
					leadDays: row.suggested_lead_days ?? 5,
				},
	substitutes: [...row.cost_request_substitutes].sort(byPosition).map((s) => ({
		id: s.id,
		name: s.name,
		sku: s.sku,
		qty: Number(s.qty),
		unitCost: Number(s.unit_cost),
		why: s.why,
	})),
});

const toCostRequest = (row: RequestRow): CostRequest => {
	const parts = [...row.cost_request_parts].sort(byPosition);
	const resolutions: CostRequest["resolutions"] = {};
	for (const p of parts) {
		const res = resolutionOf(p);
		if (res) resolutions[p.id] = res;
	}
	return {
		id: row.id,
		title: row.title,
		target: row.target,
		newPiece: row.new_piece,
		client: row.client_name,
		quote: row.quote_number,
		requestedBy: row.requested_by_name,
		requestedById: row.requested_by,
		requestedAt: row.requested_at,
		neededBy: row.needed_by,
		size: row.size,
		quantity: row.quantity,
		markupPercent: Number(row.markup_percent),
		markupCategory: row.markup_category,
		notes: row.notes,
		images: [...row.cost_request_images].sort(byPosition).map(({ src, alt }) => ({ src, alt })),
		parts: parts.map(toPart),
		status: row.status,
		resolutions,
		questions: [...row.cost_request_messages]
			.sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id)
			.map((m) => ({
				id: String(m.id),
				by: m.author_name,
				byId: m.author_id,
				text: m.body,
				at: m.created_at,
			})),
		declineReason: row.decline_reason ? declineLabel(row.decline_reason, row.needed_by) : null,
		alternative: row.alternative,
		saveAsType: row.save_as_type,
		approvedBy: row.approved_by_name,
		approvedCost: row.approved_cost === null ? null : Number(row.approved_cost),
	};
};

/** Every cost request the user can see, newest first. Reviewers see all; requesters their own. */
export async function getCostRequests(): Promise<CostRequest[]> {
	const supabase = await createClient();
	const { data, error } = await supabase
		.from("cost_requests")
		.select(COLUMNS)
		.order("requested_at", { ascending: false });
	if (error) throw new Error(`Couldn't load cost requests: ${error.message}`);
	return (data as unknown as RequestRow[]).map(toCostRequest);
}

/** One cost request, or null when it doesn't exist or the user can't see it. */
export async function getCostRequest(id: string): Promise<CostRequest | null> {
	const supabase = await createClient();
	const { data, error } = await supabase
		.from("cost_requests")
		.select(COLUMNS)
		.eq("id", id)
		.maybeSingle();
	if (error) throw new Error(`Couldn't load cost request ${id}: ${error.message}`);
	return data ? toCostRequest(data as unknown as RequestRow) : null;
}
