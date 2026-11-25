"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, userWith, type ActionResult } from "@/lib/actionResult";
import { needsApproval, poNumber, type POStatus } from "@/lib/purchaseOrders";
import { isOwnerAppRole } from "@/lib/roles";
import { createClient } from "@/utils/supabase/server";

const NO_ACCESS = "You don't have permission to change purchase orders.";

const lineSchema = z.object({
	sku: z.string().min(1),
	name: z.string().min(1),
	unit: z.string().min(1),
	ordered: z.number().positive("Quantities must be more than 0"),
	unitCost: z.number().nonnegative(),
});

const orderSchema = z.object({
	supplierId: z.string().min(1, "Pick a supplier"),
	lines: z.array(lineSchema).min(1, "Add at least one part"),
	/** Save as a draft, or send now (goes to approval when over the limit). */
	send: z.boolean(),
	expected: z.string().nullable().default(null),
	jobCard: z.string().nullable().default(null),
	client: z.string().nullable().default(null),
	deliverTo: z.string().default(""),
	paymentTerms: z.string().default(""),
	note: z.string().trim().default(""),
});

export type NewPurchaseOrder = z.input<typeof orderSchema>;
export type CreatedOrder = { number: string; status: POStatus };

function revalidateOrders() {
	revalidatePath("/purchase-orders", "layout");
	revalidatePath("/inventory");
	revalidatePath("/suppliers", "layout");
}

const totalOf = (lines: { ordered: number; unitCost: number }[]) =>
	lines.reduce((sum, l) => sum + l.ordered * l.unitCost, 0);

export async function createPurchaseOrdersAction(
	raw: NewPurchaseOrder[],
): Promise<ActionResult<CreatedOrder[]>> {
	const actor = await userWith("purchase_orders.edit");
	if (!actor) return fail(NO_ACCESS);
	const parsed = z.array(orderSchema).min(1).safeParse(raw);
	if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid order.");

	const supabase = await createClient();
	const { data: existing, error: readError } = await supabase
		.from("purchase_orders")
		.select("number");
	if (readError) return fail(readError.message);
	const taken = new Set((existing ?? []).map((po) => po.number as string));

	const created: CreatedOrder[] = [];
	for (const order of parsed.data) {
		const number = poNumber(taken);
		taken.add(number);
		const status: POStatus = !order.send
			? "draft"
			: needsApproval(totalOf(order.lines))
				? "approval"
				: "sent";

		const { error } = await supabase.from("purchase_orders").insert({
			number,
			raised_by: actor.name,
			raised_by_id: actor.id,
			supplier_id: order.supplierId,
			status,
			expected: status === "sent" ? order.expected : null,
			approval_requested_at: status === "approval" ? new Date().toISOString() : null,
			job_card: order.jobCard,
			client: order.client,
			deliver_to: order.deliverTo,
			payment_terms: order.paymentTerms,
			note: order.note,
		});
		if (error) return fail(error.message);

		const { error: linesError } = await supabase.from("purchase_order_lines").insert(
			order.lines.map((l) => ({
				po_number: number,
				sku: l.sku,
				name: l.name,
				unit: l.unit,
				ordered: l.ordered,
				unit_cost: l.unitCost,
			})),
		);
		if (linesError) {
			await supabase.from("purchase_orders").delete().eq("number", number);
			return fail(linesError.message);
		}
		created.push({ number, status });
	}

	revalidateOrders();
	return { ok: true, data: created };
}

/** Sends a draft: straight to the supplier, or to MD/GM first when it's over the approval limit. */
export async function sendPurchaseOrderAction(
	number: string,
	expected: string,
): Promise<ActionResult<{ status: POStatus }>> {
	if (!(await userWith("purchase_orders.edit"))) return fail(NO_ACCESS);

	const supabase = await createClient();
	const { data: lines, error: readError } = await supabase
		.from("purchase_order_lines")
		.select("ordered, unit_cost")
		.eq("po_number", number);
	if (readError) return fail(readError.message);

	const total = totalOf(
		(lines ?? []).map((l) => ({ ordered: Number(l.ordered), unitCost: Number(l.unit_cost) })),
	);
	const status: POStatus = needsApproval(total) ? "approval" : "sent";
	const { error } = await supabase
		.from("purchase_orders")
		.update(
			status === "approval"
				? { status, approval_requested_at: new Date().toISOString() }
				: { status, expected },
		)
		.eq("number", number)
		.eq("status", "draft");
	if (error) return fail(error.message);

	revalidateOrders();
	return { ok: true, data: { status } };
}

/** MD or GM approves an order waiting for approval; it's then sent. */
export async function approvePurchaseOrderAction(
	number: string,
	expected: string,
): Promise<ActionResult> {
	const actor = await userWith("purchase_orders.edit");
	if (!actor || !isOwnerAppRole(actor.roleKey)) {
		return fail("Only the MD or GM can approve purchase orders.");
	}

	const supabase = await createClient();
	const { error } = await supabase
		.from("purchase_orders")
		.update({ status: "sent", expected, approved_by: actor.id })
		.eq("number", number)
		.eq("status", "approval");
	if (error) return fail(error.message);

	await supabase.from("audit_logs").insert({
		actor_id: actor.id,
		action: "purchase_order.approved",
		entity_type: "purchase_order",
		entity_id: number,
	});

	revalidateOrders();
	return { ok: true };
}

const deliverySchema = z.object({
	received: z.record(z.string(), z.number().nonnegative()),
	date: z.string().min(1),
	quality: z.enum(["As ordered", "Minor issues", "Rejected some"]),
});

/** Records what arrived, adds it to stock, and marks the order part- or fully received. */
export async function recordDeliveryAction(
	number: string,
	raw: z.input<typeof deliverySchema>,
): Promise<ActionResult<{ status: POStatus }>> {
	if (!(await userWith("purchase_orders.edit"))) return fail(NO_ACCESS);
	const parsed = deliverySchema.safeParse(raw);
	if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid delivery.");

	const supabase = await createClient();
	const { data, error } = await supabase.rpc("record_po_delivery", {
		p_number: number,
		p_received: parsed.data.received,
		p_delivered_on: parsed.data.date,
		p_quality: parsed.data.quality,
	});
	if (error) return fail(error.message);

	revalidateOrders();
	return { ok: true, data: { status: data as POStatus } };
}

export async function deleteDraftPurchaseOrderAction(number: string): Promise<ActionResult> {
	if (!(await userWith("purchase_orders.edit"))) return fail(NO_ACCESS);

	const supabase = await createClient();
	const { data, error } = await supabase
		.from("purchase_orders")
		.delete()
		.eq("number", number)
		.eq("status", "draft")
		.select("number");
	if (error) return fail(error.message);
	if (!data?.length) return fail("Only draft orders can be deleted.");

	revalidateOrders();
	return { ok: true };
}
