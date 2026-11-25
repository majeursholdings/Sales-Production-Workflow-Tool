"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, userWith, type ActionResult } from "@/lib/actionResult";
import {
	CONFIDENCE_THRESHOLD,
	DECLINE_REASONS,
	reviewOf,
	type Resolution,
} from "@/lib/costRequests";
import { getCostRequest } from "@/lib/data/costRequests";
import { getInventory } from "@/lib/data/procurement";
import { PART_CATEGORIES, suggestSku } from "@/lib/inventory";
import { hasPermission } from "@/lib/roles";
import { getCurrentUser } from "@/lib/session";
import { createClient } from "@/utils/supabase/server";

const NO_ACCESS = "You don't have permission to review cost requests.";
const NOT_OPEN = "This request is already closed. Refresh to see its latest state.";

function revalidateRequests(stockChanged = false) {
	revalidatePath("/cost-requests");
	if (stockChanged) {
		revalidatePath("/inventory");
		revalidatePath("/suppliers", "layout");
	}
}

// ─── Raise a request (quote builder's custom design flow) ────────────────────

const substituteSchema = z.object({
	name: z.string().trim().min(1),
	sku: z.string().trim().min(1),
	qty: z.number().positive(),
	unitCost: z.number().nonnegative(),
	why: z.string().trim().default(""),
});

const partSchema = z.object({
	name: z.string().trim().min(1, "Every part needs a name"),
	sku: z.string().trim().min(1).nullable().default(null),
	use: z.string().trim().default(""),
	qty: z.number().positive("Quantities must be more than 0"),
	unitCost: z.number().nonnegative().default(0),
	confidence: z.number().int().min(0).max(100),
	kind: z.enum(["stock", "missing", "priced"]).default("stock"),
	note: z.string().trim().optional(),
	pin: z.tuple([z.number().min(0).max(100), z.number().min(0).max(100)]).nullable().default(null),
	doubt: z.string().trim().optional(),
	askedToAdd: z.boolean().default(false),
	suggestion: z
		.object({
			unitCost: z.number().nonnegative(),
			supplierId: z.string().trim().min(1),
			leadDays: z.number().int().nonnegative(),
		})
		.optional(),
	substitutes: z.array(substituteSchema).default([]),
});

const requestSchema = z.object({
	title: z.string().trim().min(1, "Give the design a name"),
	target: z.string().trim().default("New piece"),
	newPiece: z.boolean().default(true),
	clientId: z.uuid().nullable().default(null),
	client: z.string().trim().min(1, "Pick a client"),
	quoteId: z.uuid().nullable().default(null),
	quote: z.string().trim().min(1, "A cost request needs its quote number"),
	neededBy: z.iso.date("Pick the date it's needed by"),
	size: z.string().trim().default(""),
	quantity: z.number().int().positive(),
	markupPercent: z.number().nonnegative(),
	markupCategory: z.string().trim().default(""),
	notes: z.string().trim().default(""),
	images: z
		.array(z.object({ src: z.string().trim().min(1), alt: z.string().trim().default("") }))
		.default([]),
	parts: z.array(partSchema).min(1, "The parts list is empty"),
});

export type NewCostRequest = z.input<typeof requestSchema>;

/** Sends a custom design's parts list to procurement. Returns the new request's number, e.g. CR-0001. */
export async function createCostRequestAction(
	raw: NewCostRequest,
): Promise<ActionResult<{ id: string }>> {
	const actor = await userWith("quotes.create");
	if (!actor) return fail("You don't have permission to raise cost requests.");
	const parsed = requestSchema.safeParse(raw);
	if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid cost request.");
	const r = parsed.data;

	const supabase = await createClient();
	const { data, error } = await supabase.rpc("create_cost_request", {
		p_request: {
			title: r.title,
			target: r.target,
			new_piece: r.newPiece,
			client_id: r.clientId,
			client_name: r.client,
			quote_id: r.quoteId,
			quote_number: r.quote,
			requested_by_name: actor.name,
			needed_by: r.neededBy,
			size: r.size,
			quantity: r.quantity,
			markup_percent: r.markupPercent,
			markup_category: r.markupCategory,
			notes: r.notes,
			images: r.images,
			parts: r.parts.map((p) => ({
				name: p.name,
				sku: p.sku,
				use: p.use,
				qty: p.qty,
				unit_cost: p.unitCost,
				confidence: p.confidence,
				kind: p.kind,
				note: p.note ?? null,
				pin_x: p.pin?.[0] ?? null,
				pin_y: p.pin?.[1] ?? null,
				doubt: p.doubt ?? null,
				asked_to_add: p.askedToAdd,
				suggested_unit_cost: p.suggestion?.unitCost ?? null,
				suggested_supplier_id: p.suggestion?.supplierId ?? null,
				suggested_lead_days: p.suggestion?.leadDays ?? null,
				substitutes: p.substitutes.map((s) => ({
					name: s.name,
					sku: s.sku,
					qty: s.qty,
					unit_cost: s.unitCost,
					why: s.why,
				})),
			})),
		},
	});
	if (error) return fail(error.message);
	const id = data as string;

	await supabase.from("audit_logs").insert({
		actor_id: actor.id,
		action: "cost_request.created",
		entity_type: "cost_request",
		entity_id: id,
		new_values: { quote: r.quote, title: r.title, parts: r.parts.length },
	});

	revalidateRequests();
	return { ok: true, data: { id } };
}

// ─── Questions and replies ───────────────────────────────────────────────────

const messageSchema = z.string().trim().min(1, "Write your question").max(2000);

/** Procurement asks the requester a question, or the requester replies. */
export async function postCostRequestMessageAction(
	id: string,
	text: string,
): Promise<ActionResult> {
	const user = await getCurrentUser();
	const parsed = messageSchema.safeParse(text);
	if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Write your question.");

	const supabase = await createClient();
	const { data: request, error: readError } = await supabase
		.from("cost_requests")
		.select("status, requested_by")
		.eq("id", id)
		.maybeSingle();
	if (readError) return fail(readError.message);
	if (!request) return fail("Cost request not found.");
	if (request.status !== "open") return fail(NOT_OPEN);
	const isRequester = request.requested_by === user.id;
	if (!isRequester && !hasPermission(user.roleKey, "materials.edit")) return fail(NO_ACCESS);

	const { error } = await supabase.from("cost_request_messages").insert({
		request_id: id,
		author_id: user.id,
		author_name: user.name,
		body: parsed.data,
	});
	if (error) return fail(error.message);

	revalidateRequests();
	return { ok: true };
}

// ─── Approve ─────────────────────────────────────────────────────────────────

const resolutionSchema = z.discriminatedUnion("kind", [
	z.object({ kind: z.literal("keep") }),
	z.object({ kind: z.literal("drop") }),
	z.object({ kind: z.literal("sub"), id: z.string().min(1) }),
	z.object({
		kind: z.literal("oneOff"),
		unitCost: z.number().positive("Enter a cost above ₦0"),
		supplierId: z.string().trim().min(1, "Pick who makes it"),
		leadDays: z.number().int("Enter whole days").min(0).max(999),
		addToInventory: z.boolean(),
		category: z.string().optional(),
		unit: z.string().optional(),
	}),
]);

const approveSchema = z.object({
	resolutions: z.record(z.string(), resolutionSchema),
	saveAsType: z.boolean(),
});

export type ApproveCostRequest = z.input<typeof approveSchema>;

/**
 * Approves the parts list with procurement's choices for flagged parts. The
 * cost is worked out again here from live inventory, and one-off parts marked
 * "add to inventory" become parts (with the supplier's price) in one go.
 */
export async function approveCostRequestAction(
	id: string,
	raw: ApproveCostRequest,
): Promise<ActionResult<{ cost: number; addedSkus: string[] }>> {
	const actor = await userWith("materials.edit");
	if (!actor) return fail(NO_ACCESS);
	const parsed = approveSchema.safeParse(raw);
	if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid choices.");

	const [request, inventory] = await Promise.all([getCostRequest(id), getInventory()]);
	if (!request) return fail("Cost request not found.");
	if (request.status !== "open") return fail(NOT_OPEN);

	// Only flagged parts take a resolution, and only one that fits the kind of flag
	const resolutions: Record<string, Resolution> = {};
	for (const part of request.parts) {
		const res = parsed.data.resolutions[part.id];
		if (!res) continue;
		const missing = part.kind === "missing";
		const unsure = !missing && part.confidence < CONFIDENCE_THRESHOLD;
		if (missing && res.kind === "sub" && !part.substitutes?.some((s) => s.id === res.id)) {
			return fail(`Pick one of the agent's substitutes for ${part.name}.`);
		}
		if (missing && (res.kind === "sub" || res.kind === "oneOff")) resolutions[part.id] = res;
		else if (unsure && (res.kind === "keep" || res.kind === "drop")) resolutions[part.id] = res;
	}

	const review = reviewOf({ ...request, resolutions }, inventory);
	if (review.open > 0) {
		return fail(
			`Sort out ${review.open} flagged part${review.open === 1 ? "" : "s"} before approving.`,
		);
	}

	// One-off parts to add to inventory: a fresh SKU each, from the category and name
	const supabase = await createClient();
	const newParts: {
		partId: string;
		sku: string;
		name: string;
		category: string;
		unit: string;
		unitCost: number;
		supplierId: string;
		leadDays: number;
	}[] = [];
	const toStock = request.parts.filter((p) => {
		const res = resolutions[p.id];
		return res?.kind === "oneOff" && res.addToInventory;
	});
	if (toStock.length > 0) {
		const { data: skus, error: skuError } = await supabase.from("parts").select("sku");
		if (skuError) return fail(skuError.message);
		const taken = new Set((skus ?? []).map((row) => row.sku as string));
		for (const part of toStock) {
			const res = resolutions[part.id] as Extract<Resolution, { kind: "oneOff" }>;
			const category = PART_CATEGORIES.find((c) => c === res.category);
			if (!category) return fail(`Pick an inventory category for ${part.name}.`);
			const unit = res.unit?.trim();
			if (!unit) return fail(`Pick a unit for ${part.name}.`);
			const sku = suggestSku(category, part.name, taken);
			taken.add(sku);
			newParts.push({
				partId: part.id,
				sku,
				name: part.name,
				category,
				unit,
				unitCost: res.unitCost,
				supplierId: res.supplierId,
				leadDays: res.leadDays,
			});
		}
	}

	const { error } = await supabase.rpc("approve_cost_request", {
		p_id: id,
		p_cost: review.cost,
		p_save_as_type: request.newPiece && parsed.data.saveAsType,
		p_approver_name: actor.name,
		p_resolutions: Object.entries(resolutions).map(([partId, res]) => ({
			part_id: partId,
			resolution: res.kind,
			substitute_id: res.kind === "sub" ? res.id : null,
			one_off_unit_cost: res.kind === "oneOff" ? res.unitCost : null,
			one_off_supplier_id: res.kind === "oneOff" ? res.supplierId : null,
			one_off_lead_days: res.kind === "oneOff" ? res.leadDays : null,
			add_to_inventory: res.kind === "oneOff" && res.addToInventory,
			added_sku: newParts.find((n) => n.partId === partId)?.sku ?? null,
		})),
		p_new_parts: newParts.map((n) => ({
			sku: n.sku,
			name: n.name,
			category: n.category,
			unit: n.unit,
			unit_cost: n.unitCost,
			supplier_id: n.supplierId,
			lead_days: n.leadDays,
		})),
	});
	if (error) return fail(error.message);

	const addedSkus = newParts.map((n) => n.sku);
	await supabase.from("audit_logs").insert({
		actor_id: actor.id,
		action: "cost_request.approved",
		entity_type: "cost_request",
		entity_id: id,
		new_values: { approved_cost: review.cost, added_skus: addedSkus },
	});

	revalidateRequests(addedSkus.length > 0);
	return { ok: true, data: { cost: review.cost, addedSkus } };
}

// ─── Decline and reopen ──────────────────────────────────────────────────────

const declineSchema = z.object({
	reason: z.enum(DECLINE_REASONS.map((r) => r.value)),
	alternative: z.string().trim().max(2000).default(""),
});

export type DeclineCostRequest = z.input<typeof declineSchema>;

/** Marks a request "can't source", with why and an optional alternative. */
export async function declineCostRequestAction(
	id: string,
	raw: DeclineCostRequest,
): Promise<ActionResult> {
	const actor = await userWith("materials.edit");
	if (!actor) return fail(NO_ACCESS);
	const parsed = declineSchema.safeParse(raw);
	if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Pick a reason.");

	const supabase = await createClient();
	const { data, error } = await supabase
		.from("cost_requests")
		.update({
			status: "declined",
			decline_reason: parsed.data.reason,
			alternative: parsed.data.alternative || null,
			resolved_at: new Date().toISOString(),
		})
		.eq("id", id)
		.eq("status", "open")
		.select("id");
	if (error) return fail(error.message);
	if (!data?.length) return fail(NOT_OPEN);

	await supabase.from("audit_logs").insert({
		actor_id: actor.id,
		action: "cost_request.declined",
		entity_type: "cost_request",
		entity_id: id,
		new_values: parsed.data,
	});

	revalidateRequests();
	return { ok: true };
}

/** Reopens a request marked "can't source", so it can be reviewed again. */
export async function reopenCostRequestAction(id: string): Promise<ActionResult> {
	const actor = await userWith("materials.edit");
	if (!actor) return fail(NO_ACCESS);

	const supabase = await createClient();
	const { data, error } = await supabase
		.from("cost_requests")
		.update({ status: "open", decline_reason: null, alternative: null, resolved_at: null })
		.eq("id", id)
		.eq("status", "declined")
		.select("id");
	if (error) return fail(error.message);
	if (!data?.length) return fail("Only requests marked can't source can be reopened.");

	await supabase.from("audit_logs").insert({
		actor_id: actor.id,
		action: "cost_request.reopened",
		entity_type: "cost_request",
		entity_id: id,
	});

	revalidateRequests();
	return { ok: true };
}
