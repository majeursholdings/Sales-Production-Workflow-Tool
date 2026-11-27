"use server";

import dayjs from "dayjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { addressLine } from "@/lib/address";
import { postalAddressSchema } from "@/lib/address/schema";
import { fail, userWith, type ActionResult } from "@/lib/actionResult";
import { getJobCard, getQuotesWithoutJobCard, getWorkshopPeople } from "@/lib/data/jobCards";
import {
	DELIVERY_STEP,
	STEP_NAMES,
	itemsSummary,
	kindOf,
	logTime,
	recordDelivery,
	sendBack,
	shortDate,
	type JobCard,
} from "@/lib/jobCards";
import { getCompanyConfig } from "@/lib/data/companySettings";
import { isValidStorageUrl } from "@/lib/storage";
import { createClient } from "@/utils/supabase/server";

const NO_ACCESS = "You don't have permission to change job cards.";
const CLOSED = "This job card is closed: its delivery was accepted.";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");
const stepIndex = z
	.number()
	.int()
	.min(0)
	.max(STEP_NAMES.length - 1);
const hours = z.number().positive("Hours must be more than 0").max(1000);

function revalidateJobCards(number?: string) {
	revalidatePath("/work-orders");
	if (number) revalidatePath(`/work-orders/${number}`);
	// Machine time feeds Machines; parts feed Inventory and purchase orders
	revalidatePath("/machines", "layout");
	revalidatePath("/inventory");
	revalidatePath("/purchase-orders");
}

async function openCard(number: string): Promise<JobCard | string> {
	const card = await getJobCard(number);
	if (!card) return "That job card no longer exists.";
	if (card.closed) return CLOSED;
	return card;
}

/** Saves the step statuses that differ between the card before and after a change. */
async function saveStatuses(supabase: Supabase, before: JobCard, after: JobCard) {
	for (const [index, step] of after.steps.entries()) {
		if (step.status === before.steps[index].status) continue;
		const { error } = await supabase
			.from("job_card_steps")
			.update({ status: step.status })
			.eq("job_card", after.id)
			.eq("step_index", index);
		if (error) return error.message;
	}
	return null;
}

// ─── Create ──────────────────────────────────────────────────────────────────

const createSchema = z.object({
	quoteId: z.string().uuid("Pick a quote"),
	due: isoDate,
	addressParts: postalAddressSchema,
	note: z.string().trim().default(""),
	plannedHours: z.array(z.number().nonnegative().max(10000)).length(STEP_NAMES.length),
	parts: z
		.array(
			z.object({
				sku: z.string().min(1),
				qty: z.number().positive("Quantities must be more than 0"),
			}),
		)
		.default([]),
});

export type NewJobCard = z.input<typeof createSchema>;

/**
 * Starts a job card from a quote whose deposit is paid: its items come from the
 * quote's current version, and its parts are reserved from stock straight away.
 */
export async function createJobCardAction(
	raw: NewJobCard,
): Promise<ActionResult<{ number: string; short: boolean }>> {
	const actor = await userWith("work_orders.edit_status");
	if (!actor) return fail(NO_ACCESS);
	const parsed = createSchema.safeParse(raw);
	if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid job card.");
	const d = parsed.data;

	const quote = (await getQuotesWithoutJobCard()).find((q) => q.id === d.quoteId);
	if (!quote) return fail("That quote already has a job card, or its deposit isn't paid yet.");
	if (quote.items.length === 0) return fail("That quote has no items to build.");

	const supabase = await createClient();
	const { data: number, error } = await supabase.rpc("create_job_card", {
		p_card: {
			quote_id: quote.id,
			quote_number: quote.number,
			client_id: quote.clientId,
			client_name: quote.client,
			items_summary: itemsSummary(quote.items),
			icon: kindOf(quote.items[0].name),
			due: d.due,
			address: addressLine(d.addressParts),
			note: d.note,
		},
		p_items: quote.items.map((i) => ({ ...i, kind: kindOf(i.name) })),
		p_parts: d.parts,
		p_planned_hours: d.plannedHours,
		p_prefix: (await getCompanyConfig()).numbering.jobCard,
	});
	if (error) return fail(error.message);

	// create_job_card takes the address written out; its parts go on afterwards.
	await supabase
		.from("job_cards")
		.update({ address_parts: d.addressParts })
		.eq("number", number as string);

	const { data: firstStep } = await supabase
		.from("job_card_steps")
		.select("status")
		.eq("job_card", number)
		.eq("step_index", 0)
		.maybeSingle();

	await supabase.from("audit_logs").insert({
		actor_id: actor.id,
		action: "job_card.created",
		entity_type: "job_card",
		entity_id: number as string,
		new_values: { quote: quote.number, client: quote.client, due: d.due },
	});

	revalidateJobCards(number as string);
	return { ok: true, data: { number: number as string, short: firstStep?.status === "blocked" } };
}

// ─── Details ─────────────────────────────────────────────────────────────────

const detailsSchema = z.object({
	due: isoDate,
	addressParts: postalAddressSchema,
	note: z.string().trim().default(""),
	/** The day delivery is booked for, or null when it isn't booked. */
	bookedFor: isoDate.nullable(),
});

export type JobCardDetails = z.input<typeof detailsSchema>;

export async function updateJobCardAction(
	number: string,
	raw: JobCardDetails,
): Promise<ActionResult> {
	if (!(await userWith("work_orders.edit_status"))) return fail(NO_ACCESS);
	const parsed = detailsSchema.safeParse(raw);
	if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid details.");
	const d = parsed.data;

	const card = await openCard(number);
	if (typeof card === "string") return fail(card);

	// A rejected delivery stays rejected until it's re-booked
	const delivery =
		d.bookedFor !== null
			? {
					delivery_state: "booked",
					delivery_note: `Booked for ${shortDate(d.bookedFor)}`,
					delivery_booked_for: d.bookedFor,
				}
			: card.delivery.state === "booked"
				? {
						delivery_state: "not_booked",
						delivery_note: "Not booked",
						delivery_booked_for: null,
					}
				: {};

	const supabase = await createClient();
	const { error } = await supabase
		.from("job_cards")
		.update({
			due: d.due,
			address: addressLine(d.addressParts),
			address_parts: d.addressParts,
			note: d.note,
			...delivery,
		})
		.eq("number", number);
	if (error) return fail(error.message);

	revalidateJobCards(number);
	return { ok: true };
}

// ─── Time ────────────────────────────────────────────────────────────────────

const logSchema = z.object({
	step: stepIndex,
	who: z.string().trim().min(1, "Say who did the work"),
	date: isoDate,
	hours,
	machines: z.array(z.object({ machineId: z.string().min(1), hours })).default([]),
	redoNote: z.string().trim().min(1).optional(),
	notes: z.string().trim().optional(),
	finished: z.boolean(),
});

export type TimeLog = z.input<typeof logSchema>;

export async function logTimeAction(number: string, raw: TimeLog): Promise<ActionResult> {
	const actor = await userWith("work_orders.edit_status");
	if (!actor) return fail(NO_ACCESS);
	const parsed = logSchema.safeParse(raw);
	if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid time log.");
	const d = parsed.data;
	if (d.date > dayjs().format("YYYY-MM-DD")) return fail("Time can't be logged ahead of today.");

	const card = await openCard(number);
	if (typeof card === "string") return fail(card);

	const supabase = await createClient();
	const machineIds = [...new Set(d.machines.map((m) => m.machineId))];
	if (machineIds.length !== d.machines.length)
		return fail("Each machine can only be listed once.");
	const names = new Map<string, string>();
	if (machineIds.length) {
		const { data, error } = await supabase
			.from("machines")
			.select("id, name")
			.in("id", machineIds)
			.eq("is_archived", false)
			.eq("condition", "working");
		if (error) return fail(error.message);
		for (const m of data ?? []) names.set(m.id as string, m.name as string);
		if (names.size !== machineIds.length)
			return fail("One of those machines is out of service or no longer exists.");
	}

	const staff = (await getWorkshopPeople()).find((p) => p.name === d.who);

	const entryId = crypto.randomUUID();
	const { error } = await supabase.from("job_card_time_entries").insert({
		id: entryId,
		job_card: number,
		step_index: d.step,
		staff_id: staff?.id ?? null,
		who: d.who,
		worked_on: d.date,
		hours: d.hours,
		redo_note: d.redoNote ?? null,
		notes: d.notes ?? "",
		logged_by: actor.id,
	});
	if (error) return fail(error.message);

	if (d.machines.length) {
		const { error: machinesError } = await supabase.from("job_card_time_entry_machines").insert(
			d.machines.map((m) => ({
				entry_id: entryId,
				machine_id: m.machineId,
				hours: m.hours,
			})),
		);
		if (machinesError) {
			await supabase.from("job_card_time_entries").delete().eq("id", entryId);
			return fail(machinesError.message);
		}
	}

	const after = logTime(card, {
		...d,
		machines: d.machines.map((m) => ({ ...m, machine: names.get(m.machineId) ?? "" })),
	});
	const statusError = await saveStatuses(supabase, card, after);
	if (statusError) return fail(statusError);

	if (d.finished) {
		await supabase.from("audit_logs").insert({
			actor_id: actor.id,
			action: "job_card.step_finished",
			entity_type: "job_card",
			entity_id: number,
			new_values: { step: STEP_NAMES[d.step] },
		});
	}

	revalidateJobCards(number);
	return { ok: true };
}

// ─── Redos ───────────────────────────────────────────────────────────────────

const jobCardPhotos = z
	.array(
		z.string().refine((u) => isValidStorageUrl(u, "job-cards"), "Invalid job card photo URL."),
	)
	.max(6)
	.default([]);

const redoSchema = z.object({
	step: z
		.number()
		.int()
		.min(0)
		.max(DELIVERY_STEP - 1),
	reason: z.string().trim().min(1, "Say what's wrong"),
	hours,
	foundAt: z
		.string()
		.refine(
			(v) => (STEP_NAMES as readonly string[]).includes(v),
			"Pick the step it was found at",
		),
	date: isoDate,
	photos: jobCardPhotos,
});

export type RedoRecord = z.input<typeof redoSchema>;

/** Work found wrong in the workshop: the step goes back to Redo and later finished steps reopen. */
export async function recordRedoAction(number: string, raw: RedoRecord): Promise<ActionResult> {
	const actor = await userWith("work_orders.edit_status");
	if (!actor) return fail(NO_ACCESS);
	const parsed = redoSchema.safeParse(raw);
	if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid redo.");
	const d = parsed.data;

	const card = await openCard(number);
	if (typeof card === "string") return fail(card);
	const status = card.steps[d.step].status;
	if (status === "todo" || status === "blocked")
		return fail("Only a step that has started can be redone.");

	const supabase = await createClient();
	const { error } = await supabase.from("job_card_redos").insert({
		job_card: number,
		step_index: d.step,
		reason: d.reason,
		hours: d.hours,
		found_at: d.foundAt,
		happened_on: d.date,
		photo_urls: d.photos,
		recorded_by: actor.id,
	});
	if (error) return fail(error.message);

	const statusError = await saveStatuses(supabase, card, sendBack(card, d));
	if (statusError) return fail(statusError);

	await supabase.from("audit_logs").insert({
		actor_id: actor.id,
		action: "job_card.redo",
		entity_type: "job_card",
		entity_id: number,
		new_values: { step: STEP_NAMES[d.step], reason: d.reason, hours: d.hours },
	});

	revalidateJobCards(number);
	return { ok: true };
}

// ─── Delivery ────────────────────────────────────────────────────────────────

const deliverySchema = z.discriminatedUnion("outcome", [
	z.object({
		outcome: z.literal("accepted"),
		date: isoDate,
		by: z.string().trim().min(1),
		notes: z.string().trim().default(""),
		photos: jobCardPhotos,
	}),
	z.object({
		outcome: z.literal("rejected"),
		date: isoDate,
		by: z.string().trim().min(1),
		notes: z.string().trim().default(""),
		photos: jobCardPhotos,
		what: z.string().trim().min(1, "Say what was rejected"),
		reason: z.string().trim().min(1),
		backTo: z
			.number()
			.int()
			.min(0)
			.max(DELIVERY_STEP - 1),
	}),
]);

export type DeliveryRecord = z.input<typeof deliverySchema>;

/** Accepted closes the card; rejected sends it back to a step, which reopens with every step after it. */
export async function recordDeliveryAction(
	number: string,
	raw: DeliveryRecord,
): Promise<ActionResult> {
	const actor = await userWith("work_orders.edit_status");
	if (!actor) return fail(NO_ACCESS);
	const parsed = deliverySchema.safeParse(raw);
	if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid delivery.");
	const d = parsed.data;

	const card = await openCard(number);
	if (typeof card === "string") return fail(card);
	const after = recordDelivery(card, d);

	const supabase = await createClient();
	if (d.outcome === "rejected") {
		const event = after.steps[d.backTo].redos.at(-1)!;
		const { error } = await supabase.from("job_card_redos").insert({
			job_card: number,
			step_index: d.backTo,
			reason: d.notes ? `${event.reason} ${d.notes}` : event.reason,
			hours: event.hours,
			found_at: event.foundAt,
			happened_on: event.date,
			photo_urls: d.photos,
			recorded_by: actor.id,
		});
		if (error) return fail(error.message);
	}

	const { error } = await supabase
		.from("job_cards")
		.update({
			closed: after.closed,
			closed_on: after.closed ? d.date : null,
			delivery_state: after.delivery.state,
			delivery_note: after.delivery.note,
			delivery_photo_urls: after.deliveryPhotos,
			rejected_note: after.rejectedNote ?? null,
		})
		.eq("number", number);
	if (error) return fail(error.message);

	const statusError = await saveStatuses(supabase, card, after);
	if (statusError) return fail(statusError);

	await supabase.from("audit_logs").insert({
		actor_id: actor.id,
		action: d.outcome === "accepted" ? "job_card.delivered" : "job_card.delivery_rejected",
		entity_type: "job_card",
		entity_id: number,
		new_values:
			d.outcome === "accepted"
				? { date: d.date, by: d.by }
				: {
						date: d.date,
						by: d.by,
						what: d.what,
						reason: d.reason,
						back_to: STEP_NAMES[d.backTo],
					},
	});

	revalidateJobCards(number);
	return { ok: true };
}

// ─── Parts ───────────────────────────────────────────────────────────────────

/** Holds whatever is now free in stock for the card's short parts. */
export async function reservePartsAction(
	number: string,
): Promise<ActionResult<{ short: boolean }>> {
	if (!(await userWith("work_orders.edit_status"))) return fail(NO_ACCESS);
	const supabase = await createClient();
	const { data, error } = await supabase.rpc("reserve_job_card_parts", { p_number: number });
	if (error) return fail(error.message);
	revalidateJobCards(number);
	return { ok: true, data: { short: Boolean(data) } };
}

/** Takes a reserved part out of stock: it's been picked for the workshop. */
export async function pickPartAction(number: string, sku: string): Promise<ActionResult> {
	if (!(await userWith("work_orders.edit_status"))) return fail(NO_ACCESS);
	const card = await openCard(number);
	if (typeof card === "string") return fail(card);
	const supabase = await createClient();
	const { error } = await supabase.rpc("pick_job_card_part", { p_number: number, p_sku: sku });
	if (error) return fail(error.message);
	revalidateJobCards(number);
	return { ok: true };
}
