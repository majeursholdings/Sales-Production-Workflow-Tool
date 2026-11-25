"use server";

import dayjs from "dayjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, userWith } from "@/lib/actionResult";
import type { Client } from "@/lib/clients";
import { formatNaira } from "@/lib/currency";
import { getCompanySettings } from "@/lib/data/companySettings";
import { getBuilderCatalog, getNextQuoteNumber } from "@/lib/data/quoteBuilder";
import { clientLines, priceQuote, quoteDateLabel } from "@/lib/quoteBuilder";
import { requirePermission, requireRouteAccess } from "@/lib/session";
import { createClient } from "@/utils/supabase/server";

export type ActionResult = { ok: true } | { ok: false; message: string };

const recordDepositSchema = z.object({
	quoteNumber: z.string().min(1),
	versionNumber: z.number().int().positive(),
	amount: z.number().positive(),
	reference: z.string().trim().default(""),
	/** YYYY-MM-DD the money arrived. */
	paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the date the deposit arrived"),
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

	const { quoteNumber, versionNumber, amount, reference, paidOn } = parsed.data;
	if (dayjs(paidOn).isAfter(dayjs(), "day")) {
		return { ok: false, message: "The deposit date can't be in the future." };
	}
	const invoicePrefix = (await getCompanySettings()).numbering.invoice;
	const supabase = await createClient();

	const { data: quote, error: fetchError } = await supabase
		.from("quotes")
		.select("id, status, client_id")
		.eq("quote_number", quoteNumber)
		.single();

	if (fetchError || !quote) {
		return { ok: false, message: "Quote not found." };
	}

	// Issues the invoice, records the deposit as its first payment and marks the quote paid, in one transaction
	const { data: invoiceNumber, error: depositError } = await supabase.rpc(
		"record_quote_deposit",
		{
			p_quote_number: quoteNumber,
			p_version: versionNumber,
			p_amount: amount,
			p_paid_on: paidOn,
			p_reference: reference,
			p_actor_name: actor.name,
			p_actor_role: actor.role,
			p_prefix: invoicePrefix,
		},
	);

	if (depositError) {
		return { ok: false, message: depositError.message };
	}

	const nowLabel = dayjs().format("D MMM YYYY, HH:mm");
	const detailParts = [
		formatNaira(amount),
		reference ? `ref ${reference}` : null,
		`invoice ${invoiceNumber as string}`,
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
			new_values: { status: "paid", amount, reference, invoice: invoiceNumber },
		}),
	]);

	revalidatePath("/quotes");
	revalidatePath(`/quotes/${quoteNumber}`);
	revalidatePath("/invoices", "layout");
	revalidatePath("/finance");
	revalidatePath("/");
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

// ─── Quote builder ───────────────────────────────────────────────────────────

const builderSchema = z.object({
	/** The saved quote's number when this draft was saved before. */
	quoteNumber: z.string().min(1).nullable(),
	clientId: z.string().uuid("Choose a client first."),
	items: z.array(z.string().uuid()).min(1, "Add at least one furniture item."),
	qty: z.record(z.string(), z.number().int().min(1)),
	removedParts: z.array(z.string()),
	hours: z.record(z.string(), z.number().min(0)),
	projectCosts: z.array(
		z.object({
			id: z.string(),
			name: z.string().trim().min(1),
			type: z.enum(["Direct", "Indirect"]),
			per: z.string(),
			amount: z.number().nonnegative(),
		}),
	),
	discount: z.number().min(0),
	discountReason: z.string().trim().default(""),
	currency: z.enum(["NGN", "USD"]),
});

export type BuilderQuoteInput = z.input<typeof builderSchema>;
export type SavedBuilderQuote = {
	quoteNumber: string;
	issued: string;
	validUntil: string;
	status: "draft" | "sent";
};

/**
 * Saves the quote builder's draft as a quote (status draft), or sends it. Prices are
 * worked out again here from the furniture templates and today's rates, so what's
 * stored doesn't depend on the browser. The first save takes the next free number
 * for the day; later saves of the same draft update that quote while it's a draft.
 */
export async function saveBuilderQuoteAction(
	rawInput: BuilderQuoteInput,
	send: boolean,
): Promise<{ ok: true; data: SavedBuilderQuote } | { ok: false; message: string }> {
	const actor = await userWith("quotes.create");
	if (!actor) return fail("You don't have permission to create quotes.");
	const parsed = builderSchema.safeParse(rawInput);
	if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid quote.");
	const input = parsed.data;

	const supabase = await createClient();
	const { data: clientRow, error: clientError } = await supabase
		.from("clients")
		.select("id, name, client_type")
		.eq("id", input.clientId)
		.maybeSingle();
	if (clientError) return fail(clientError.message);
	if (!clientRow) return fail("That client isn't in Clients. Choose or add the client again.");

	const { catalog, rates } = await getBuilderCatalog();
	const isTrade = clientRow.client_type === "Trade";
	if (!isTrade && input.discount > rates.maxDiscount) {
		return fail(`The general discount can be at most ${rates.maxDiscount}%.`);
	}
	if (input.discount > 0 && !isTrade && !input.discountReason) {
		return fail("Give a reason for the discount.");
	}

	const pricing = priceQuote(
		{
			client: { type: isTrade ? "Trade" : "Individual" } as Client,
			items: input.items,
			qty: input.qty,
			removedParts: input.removedParts,
			hours: input.hours,
			projectCosts: input.projectCosts,
			discount: input.discount,
		},
		catalog,
		rates,
	);
	if (pricing.missing.length > 0) {
		return fail(
			"A furniture type on this quote was removed or unpublished. Take it off and try again.",
		);
	}

	const lines = clientLines(pricing, input.projectCosts);
	const now = dayjs();
	const status = send ? "sent" : "draft";
	const fields = {
		client_id: clientRow.id,
		client_name: clientRow.name,
		items_summary: pricing.items
			.map((i) => (i.qty > 1 ? `${i.name} ×${i.qty}` : i.name))
			.join(", "),
		status,
		currency: input.currency,
		exchange_rate: rates.usdRate,
		vat_rate: rates.vatRate,
		deposit_rate: rates.depositRate,
		total_ngn: Math.round(pricing.total * 100) / 100,
		valid_until: now.add(rates.validDays, "day").format("YYYY-MM-DD"),
		sent_at: send ? now.toISOString() : null,
	};

	// Update the draft saved earlier, or create the quote with the next free number
	let quoteId: string;
	let quoteNumber: string;
	if (input.quoteNumber) {
		const { data: existing, error } = await supabase
			.from("quotes")
			.select("id, status")
			.eq("quote_number", input.quoteNumber)
			.maybeSingle();
		if (error) return fail(error.message);
		if (!existing) return fail("The saved draft couldn't be found.");
		if (existing.status !== "draft") return fail("This quote was already sent.");
		const { error: updateError } = await supabase
			.from("quotes")
			.update(fields)
			.eq("id", existing.id);
		if (updateError) return fail(updateError.message);
		quoteId = existing.id;
		quoteNumber = input.quoteNumber;
	} else {
		let created: { id: string; quote_number: string } | null = null;
		for (let attempt = 0; attempt < 5 && !created; attempt++) {
			const number = await getNextQuoteNumber(now);
			const { data, error } = await supabase
				.from("quotes")
				.insert({
					...fields,
					quote_number: number,
					created_by: actor.id,
					created_by_name: actor.name,
				})
				.select("id, quote_number")
				.single();
			if (data) created = data;
			// 23505: someone took the number at the same moment; try the next one
			else if (error?.code !== "23505")
				return fail(error?.message ?? "Could not save quote.");
		}
		if (!created) return fail("Couldn't get a free quote number. Try again.");
		quoteId = created.id;
		quoteNumber = created.quote_number;
	}

	// Version 1 holds the lines; a redraft replaces them
	const sentLine = send
		? `Sent ${now.format("D MMM, HH:mm")} by ${actor.name}`
		: `Draft by ${actor.name}`;
	const { data: version, error: versionError } = await supabase
		.from("quote_versions")
		.upsert(
			{ quote_id: quoteId, version_number: 1, sent_line: sentLine },
			{ onConflict: "quote_id,version_number" },
		)
		.select("id")
		.single();
	if (versionError || !version) return fail(versionError?.message ?? "Could not save quote.");

	const { error: clearError } = await supabase
		.from("quote_lines")
		.delete()
		.eq("quote_version_id", version.id);
	if (clearError) return fail(clearError.message);
	const { error: linesError } = await supabase.from("quote_lines").insert(
		lines.map((l, i) => ({
			quote_version_id: version.id,
			name: l.name,
			description: l.description,
			quantity: l.qty,
			unit_price: Math.round(l.unitPrice * 100) / 100,
			sort_order: i,
		})),
	);
	if (linesError) return fail(linesError.message);

	const what = send ? "Quote sent" : input.quoteNumber ? "Draft updated" : "Draft created";
	const detail = [
		`by ${actor.name}`,
		formatNaira(pricing.total),
		pricing.discountPercent > 0
			? `${pricing.discountPercent}% discount: ${input.discountReason}`
			: null,
	]
		.filter(Boolean)
		.join(" · ");
	await Promise.all([
		supabase.from("quote_activity").insert({
			quote_id: quoteId,
			actor_id: actor.id,
			when_label: now.format("D MMM YYYY, HH:mm"),
			what,
			detail,
		}),
		supabase.from("audit_logs").insert({
			actor_id: actor.id,
			action: send ? "quote.sent" : "quote.draft_saved",
			entity_type: "quote",
			entity_id: quoteNumber,
			new_values: {
				status,
				total_ngn: fields.total_ngn,
				items: input.items.length,
				discount_percent: pricing.discountPercent,
				discount_reason: input.discountReason || null,
				currency: input.currency,
			},
		}),
	]);

	revalidatePath("/quotes");
	revalidatePath(`/quotes/${quoteNumber}`);
	revalidatePath("/quotes/new", "layout");
	return {
		ok: true,
		data: {
			quoteNumber,
			issued: quoteDateLabel(now),
			validUntil: quoteDateLabel(fields.valid_until),
			status,
		},
	};
}
