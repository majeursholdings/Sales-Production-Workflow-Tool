"use server";

import dayjs from "dayjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, userWith, type ActionResult } from "@/lib/actionResult";
import { MAINTENANCE_TYPES, slugOf } from "@/lib/machines";
import { isOwnerAppRole } from "@/lib/roles";
import { isValidStorageUrl } from "@/lib/storage";
import { removeStorageUrls } from "@/lib/storageServer";
import { createClient } from "@/utils/supabase/server";

const NO_ACCESS = "You don't have permission to change machines.";
const OWNERS_ONLY = "Only the MD or GM can delete machines or maintenance records.";

/** Production, procurement and the MD or GM look after machines. */
async function machineEditor() {
	return (await userWith("work_orders.edit_status")) ?? (await userWith("materials.edit"));
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");

const machinePhotoUrl = z
	.string()
	.trim()
	.refine((u) => !u || isValidStorageUrl(u, "machines"), "Invalid machine photo URL.");

const detailsSchema = z.object({
	name: z.string().trim().min(1, "Machine name is required"),
	serialNumber: z.string().trim().min(1, "Serial number is required"),
	location: z.string().trim().min(1, "Location is required"),
	bought: z.string().trim().min(1, "When it was bought is required"),
	serviceEveryMonths: z.number().int().min(1).max(24),
	hourlyCost: z.number().nonnegative(),
	notes: z.string().trim().default(""),
	photoUrl: machinePhotoUrl.default(""),
});

const updateSchema = detailsSchema.extend({
	condition: z.enum(["working", "out_of_service"]),
});

const maintenanceSchema = z.object({
	type: z.enum(MAINTENANCE_TYPES),
	date: isoDate,
	doneBy: z.string().trim().min(1, "Say who did it"),
	cost: z.number().nonnegative("Cost can't be below ₦0"),
	notes: z.string().trim().default(""),
	photos: z
		.array(
			z
				.string()
				.refine((u) => isValidStorageUrl(u, "machines"), "Invalid maintenance photo URL."),
		)
		.max(6)
		.default([]),
	nextService: isoDate.optional(),
	backInService: z.boolean().optional(),
});

function revalidateMachines(id?: string) {
	revalidatePath("/machines");
	if (id) revalidatePath(`/machines/${id}`);
}

export async function createMachineAction(
	raw: z.input<typeof detailsSchema>,
): Promise<ActionResult<{ id: string }>> {
	const actor = await machineEditor();
	if (!actor) return fail(NO_ACCESS);
	const parsed = detailsSchema.safeParse(raw);
	if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid machine.");
	const d = parsed.data;

	const supabase = await createClient();
	const { data: existing, error: readError } = await supabase.from("machines").select("id");
	if (readError) return fail(readError.message);
	const taken = new Set((existing ?? []).map((m) => m.id as string));
	const base = slugOf(d.name) || "machine";
	let id = base;
	for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;

	const { error } = await supabase.from("machines").insert({
		id,
		name: d.name,
		serial_number: d.serialNumber,
		location: d.location,
		bought: d.bought,
		service_every_months: d.serviceEveryMonths,
		// Production doesn't see or set what machine time costs
		hourly_cost: actor.roleKey === "production" ? 0 : d.hourlyCost,
		notes: d.notes,
		photo_url: d.photoUrl,
		condition: "working",
		next_service: dayjs().add(d.serviceEveryMonths, "month").format("YYYY-MM-DD"),
		created_by: actor.id,
	});
	if (error) return fail(error.message);

	await supabase.from("audit_logs").insert({
		actor_id: actor.id,
		action: "machine.created",
		entity_type: "machine",
		entity_id: id,
		new_values: { name: d.name, serial_number: d.serialNumber },
	});

	revalidateMachines();
	return { ok: true, data: { id } };
}

export async function updateMachineAction(
	id: string,
	raw: z.input<typeof updateSchema>,
): Promise<ActionResult> {
	const actor = await machineEditor();
	if (!actor) return fail(NO_ACCESS);
	const parsed = updateSchema.safeParse(raw);
	if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid machine.");
	const d = parsed.data;

	const supabase = await createClient();
	const { data: before, error: readError } = await supabase
		.from("machines")
		.select("condition, next_service, hourly_cost, photo_url")
		.eq("id", id)
		.eq("is_archived", false)
		.maybeSingle();
	if (readError) return fail(readError.message);
	if (!before) return fail("That machine no longer exists.");

	// Out of service waits on a repair, not a date; back in service starts the clock again
	const nextService =
		d.condition === "out_of_service"
			? null
			: (before.next_service ??
				dayjs().add(d.serviceEveryMonths, "month").format("YYYY-MM-DD"));

	const { error } = await supabase
		.from("machines")
		.update({
			name: d.name,
			serial_number: d.serialNumber,
			location: d.location,
			bought: d.bought,
			service_every_months: d.serviceEveryMonths,
			...(actor.roleKey === "production" ? {} : { hourly_cost: d.hourlyCost }),
			notes: d.notes,
			photo_url: d.photoUrl,
			condition: d.condition,
			next_service: nextService,
		})
		.eq("id", id);
	if (error) return fail(error.message);

	if (before.photo_url && before.photo_url !== d.photoUrl) {
		await removeStorageUrls(supabase, [before.photo_url as string], "machines");
	}

	const costChanged =
		actor.roleKey !== "production" && Number(before.hourly_cost) !== d.hourlyCost;
	if (before.condition !== d.condition || costChanged) {
		await supabase.from("audit_logs").insert({
			actor_id: actor.id,
			action: "machine.updated",
			entity_type: "machine",
			entity_id: id,
			old_values: { condition: before.condition, hourly_cost: Number(before.hourly_cost) },
			new_values: {
				condition: d.condition,
				hourly_cost: costChanged ? d.hourlyCost : Number(before.hourly_cost),
			},
		});
	}

	revalidateMachines(id);
	return { ok: true };
}

/** Machines are archived rather than deleted, so machine time already logged keeps its machine. */
export async function deleteMachineAction(id: string): Promise<ActionResult> {
	const actor = await machineEditor();
	if (!actor) return fail(NO_ACCESS);
	if (!isOwnerAppRole(actor.roleKey)) return fail(OWNERS_ONLY);

	const supabase = await createClient();
	const { data, error } = await supabase
		.from("machines")
		.update({ is_archived: true })
		.eq("id", id)
		.select("name")
		.maybeSingle();
	if (error) return fail(error.message);
	if (!data) return fail("That machine no longer exists.");

	await supabase.from("audit_logs").insert({
		actor_id: actor.id,
		action: "machine.deleted",
		entity_type: "machine",
		entity_id: id,
		old_values: { name: data.name },
	});

	revalidateMachines(id);
	return { ok: true };
}

export async function logMaintenanceAction(
	machineId: string,
	raw: z.input<typeof maintenanceSchema>,
): Promise<ActionResult> {
	const actor = await machineEditor();
	if (!actor) return fail(NO_ACCESS);
	const parsed = maintenanceSchema.safeParse(raw);
	if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid record.");
	const d = parsed.data;

	const supabase = await createClient();
	const { data: machine, error: readError } = await supabase
		.from("machines")
		.select("condition")
		.eq("id", machineId)
		.eq("is_archived", false)
		.maybeSingle();
	if (readError) return fail(readError.message);
	if (!machine) return fail("That machine no longer exists.");

	const { error } = await supabase.from("machine_maintenance").insert({
		machine_id: machineId,
		done_on: d.date,
		type: d.type,
		notes: d.notes,
		done_by: d.doneBy,
		logged_by: actor.name,
		logged_by_id: actor.id,
		cost: d.cost,
		photo_urls: d.photos,
		photo_count: d.photos.length,
	});
	if (error) return fail(error.message);

	// A machine that was out of service stays that way until someone says it's working again
	const working = machine.condition === "working" || !!d.backInService;
	const { error: updateError } = await supabase
		.from("machines")
		.update({
			condition: working ? "working" : "out_of_service",
			next_service: working ? (d.nextService ?? null) : null,
		})
		.eq("id", machineId);
	if (updateError) return fail(updateError.message);

	if (machine.condition !== (working ? "working" : "out_of_service")) {
		await supabase.from("audit_logs").insert({
			actor_id: actor.id,
			action: "machine.back_in_service",
			entity_type: "machine",
			entity_id: machineId,
			new_values: { maintenance: d.type, cost: d.cost },
		});
	}

	revalidateMachines(machineId);
	return { ok: true };
}

export async function updateMaintenanceAction(
	machineId: string,
	recordId: string,
	raw: z.input<typeof maintenanceSchema>,
): Promise<ActionResult> {
	if (!(await machineEditor())) return fail(NO_ACCESS);
	const parsed = maintenanceSchema.safeParse(raw);
	if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid record.");
	const d = parsed.data;

	const supabase = await createClient();
	const { data: before, error: readError } = await supabase
		.from("machine_maintenance")
		.select("photo_urls")
		.eq("id", recordId)
		.eq("machine_id", machineId)
		.maybeSingle();
	if (readError) return fail(readError.message);
	if (!before) return fail("That record no longer exists.");

	const { data, error } = await supabase
		.from("machine_maintenance")
		.update({
			done_on: d.date,
			type: d.type,
			notes: d.notes,
			done_by: d.doneBy,
			cost: d.cost,
			photo_urls: d.photos,
			photo_count: d.photos.length,
		})
		.eq("id", recordId)
		.eq("machine_id", machineId)
		.select("id");
	if (error) return fail(error.message);
	if (!data?.length) return fail("That record no longer exists.");

	const beforePhotos = (before.photo_urls as string[] | null) ?? [];
	const kept = new Set(d.photos);
	await removeStorageUrls(
		supabase,
		beforePhotos.filter((url) => !kept.has(url)),
		"machines",
	);

	revalidateMachines(machineId);
	return { ok: true };
}

export async function deleteMaintenanceAction(
	machineId: string,
	recordId: string,
): Promise<ActionResult> {
	const actor = await machineEditor();
	if (!actor) return fail(NO_ACCESS);
	if (!isOwnerAppRole(actor.roleKey)) return fail(OWNERS_ONLY);

	const supabase = await createClient();
	const { data, error } = await supabase
		.from("machine_maintenance")
		.delete()
		.eq("id", recordId)
		.eq("machine_id", machineId)
		.select("type, done_on, cost, photo_urls");
	if (error) return fail(error.message);
	if (!data?.length) return fail("That record no longer exists.");

	await removeStorageUrls(supabase, (data[0].photo_urls as string[] | null) ?? [], "machines");

	await supabase.from("audit_logs").insert({
		actor_id: actor.id,
		action: "machine.maintenance_deleted",
		entity_type: "machine",
		entity_id: machineId,
		old_values: data[0],
	});

	revalidateMachines(machineId);
	return { ok: true };
}
