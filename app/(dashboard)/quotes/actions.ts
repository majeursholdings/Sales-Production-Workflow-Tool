"use server";

import dayjs from "dayjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { formatNaira } from "@/lib/currency";
import { requirePermission, requireRouteAccess } from "@/lib/session";
import { createClient } from "@/utils/supabase/server";

export type ActionResult = { ok: true } | { ok: false; message: string };

const recordDepositSchema = z.object({
	quoteNumber: z.string().min(1),
	versionNumber: z.number().int().positive(),
	amount: z.number().positive(),
	reference: z.string().trim().default(""),
});

const cancelQuoteSchema = z.object({
	quoteNumber: z.string().min(1),
	reason: z.string().trim().default(""),
});

export async function recordQuoteDepositAction(
	rawInput: z.input<typeof recordDepositSchema>,
): Promise<ActionResult> {
	const actor = await requirePermission("invoices.edit");
	const parsed = recordDepositSchema.safeParse(rawInput);
	if (!parsed.success) {
		return { ok: false, message: "Invalid deposit details." };
	}

	const { quoteNumber, versionNumber, amount, reference } = parsed.data;
	const supabase = await createClient();

	const { data: quote, error: fetchError } = await supabase
		.from("quotes")
		.select("id, status, client_id")
		.eq("quote_number", quoteNumber)
		.single();

	if (fetchError || !quote) {
		return { ok: false, message: "Quote not found." };
	}

	const { error: updateError } = await supabase
		.from("quotes")
		.update({ status: "paid" })
		.eq("id", quote.id);

	if (updateError) {
		return { ok: false, message: updateError.message };
	}

	const nowLabel = dayjs().format("D MMM YYYY, HH:mm");
	const detailParts = [
		formatNaira(amount),
		reference ? `ref ${reference}` : null,
		`by ${actor.name} (${actor.role})`,
	].filter(Boolean);

	await Promise.all([
		supabase.from("quote_activity").insert({
			quote_id: quote.id,
			actor_id: actor.id,
			when_label: nowLabel,
			what: `Deposit recorded on v${versionNumber}`,
			detail: detailParts.join(" · "),
		}),
		supabase.from("audit_logs").insert({
			actor_id: actor.id,
			action: "quote.deposit_recorded",
			entity_type: "quote",
			entity_id: quoteNumber,
			old_values: { status: quote.status },
			new_values: { status: "paid", amount, reference },
		}),
	]);

	revalidatePath("/quotes");
	revalidatePath(`/quotes/${quoteNumber}`);
	return { ok: true };
}

export async function cancelQuoteAction(
	rawInput: z.input<typeof cancelQuoteSchema>,
): Promise<ActionResult> {
	const actor = await requireRouteAccess("/quotes");
	const parsed = cancelQuoteSchema.safeParse(rawInput);
	if (!parsed.success) {
		return { ok: false, message: "Invalid request." };
	}

	const { quoteNumber, reason } = parsed.data;
	const supabase = await createClient();

	const { data: quote, error: fetchError } = await supabase
		.from("quotes")
		.select("id, status")
		.eq("quote_number", quoteNumber)
		.single();

	if (fetchError || !quote) {
		return { ok: false, message: "Quote not found." };
	}

	const { error: updateError } = await supabase
		.from("quotes")
		.update({ status: "cancelled", cancel_reason: reason })
		.eq("id", quote.id);

	if (updateError) {
		return { ok: false, message: updateError.message };
	}

	await Promise.all([
		supabase.from("quote_activity").insert({
			quote_id: quote.id,
			actor_id: actor.id,
			when_label: dayjs().format("D MMM YYYY, HH:mm"),
			what: "Quote cancelled",
			detail: reason ? `by ${actor.name}: ${reason}` : `by ${actor.name}`,
		}),
		supabase.from("audit_logs").insert({
			actor_id: actor.id,
			action: "quote.cancelled",
			entity_type: "quote",
			entity_id: quoteNumber,
			old_values: { status: quote.status },
			new_values: { status: "cancelled", cancel_reason: reason },
		}),
	]);

	revalidatePath("/quotes");
	revalidatePath(`/quotes/${quoteNumber}`);
	return { ok: true };
}

export async function logQuoteFollowUpAction(quoteNumber: string): Promise<ActionResult> {
	const actor = await requireRouteAccess("/quotes");
	const supabase = await createClient();

	const { data: quote } = await supabase
		.from("quotes")
		.select("id")
		.eq("quote_number", quoteNumber)
		.maybeSingle();

	if (!quote) {
		return { ok: false, message: "Quote not found." };
	}

	const { error } = await supabase.from("quote_activity").insert({
		quote_id: quote.id,
		actor_id: actor.id,
		when_label: dayjs().format("D MMM YYYY, HH:mm"),
		what: "Follow-up logged",
		detail: `by ${actor.name}`,
	});

	if (error) {
		return { ok: false, message: error.message };
	}

	revalidatePath(`/quotes/${quoteNumber}`);
	return { ok: true };
}
