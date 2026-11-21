"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { CostItem } from "@/lib/costRates";
import { requirePermission } from "@/lib/session";
import { createClient } from "@/utils/supabase/server";

export type ActionResult<T = undefined> =
	(T extends undefined ? { ok: true } : { ok: true; data: T }) | { ok: false; message: string };

const overheadsSchema = z.object({
	rent: z.number().min(0),
	power: z.number().min(0),
	other: z.number().min(0),
	hoursEach: z.number().positive("Hours per month must be above 0"),
});

const costItemSchema = z.object({
	id: z.string().uuid().optional(),
	name: z.string().trim().min(1, "Cost item name is required"),
	note: z.string().trim().default(""),
	type: z.enum(["Direct", "Indirect"]),
	per: z.string().trim().min(1),
	amount: z.number().min(0),
});

const contingencySchema = z.object({
	percent: z.number().min(0).max(100, "Contingency must be between 0% and 100%"),
});

export async function saveOverheadsAction(
	rawInput: z.input<typeof overheadsSchema>,
): Promise<ActionResult> {
	const actor = await requirePermission("pricing_rules.edit");
	const parsed = overheadsSchema.safeParse(rawInput);
	if (!parsed.success) {
		return {
			ok: false,
			message: parsed.error.issues[0]?.message ?? "Invalid overhead inputs.",
		};
	}

	const supabase = await createClient();
	const payload = {
		id: 1,
		rent_monthly: parsed.data.rent,
		power_monthly: parsed.data.power,
		other_monthly: parsed.data.other,
		hours_per_production_person: parsed.data.hoursEach,
		updated_by: actor.id,
	};

	const { error } = await supabase
		.from("overhead_settings")
		.upsert(payload, { onConflict: "id" });

	if (error) {
		return { ok: false, message: error.message };
	}

	await supabase.from("audit_logs").insert({
		actor_id: actor.id,
		action: "overhead.updated",
		entity_type: "overhead_settings",
		entity_id: "1",
		new_values: parsed.data,
	});

	revalidatePath("/cost-rates");
	return { ok: true };
}

export async function saveCostItemAction(
	rawInput: z.input<typeof costItemSchema>,
): Promise<ActionResult<CostItem>> {
	const actor = await requirePermission("pricing_rules.edit");
	const parsed = costItemSchema.safeParse(rawInput);
	if (!parsed.success) {
		return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid cost item." };
	}

	const input = parsed.data;
	const supabase = await createClient();
	const payload = {
		name: input.name,
		note: input.note,
		cost_type: input.type,
		charged_per: input.per,
		amount: input.amount,
	};

	if (input.id) {
		const { data, error } = await supabase
			.from("cost_items")
			.update(payload)
			.eq("id", input.id)
			.select("id, name, note, cost_type, charged_per, amount")
			.single();

		if (error || !data) {
			return { ok: false, message: error?.message ?? "Could not update cost item." };
		}

		await supabase.from("audit_logs").insert({
			actor_id: actor.id,
			action: "cost_item.updated",
			entity_type: "cost_item",
			entity_id: data.id,
			new_values: payload,
		});

		revalidatePath("/cost-rates/other");
		return {
			ok: true,
			data: {
				id: data.id,
				name: data.name,
				note: data.note ?? "",
				type: data.cost_type as CostItem["type"],
				per: data.charged_per,
				amount: Number(data.amount),
			},
		};
	}

	const { data, error } = await supabase
		.from("cost_items")
		.insert(payload)
		.select("id, name, note, cost_type, charged_per, amount")
		.single();

	if (error || !data) {
		return { ok: false, message: error?.message ?? "Could not add cost item." };
	}

	await supabase.from("audit_logs").insert({
		actor_id: actor.id,
		action: "cost_item.created",
		entity_type: "cost_item",
		entity_id: data.id,
		new_values: payload,
	});

	revalidatePath("/cost-rates/other");
	return {
		ok: true,
		data: {
			id: data.id,
			name: data.name,
			note: data.note ?? "",
			type: data.cost_type as CostItem["type"],
			per: data.charged_per,
			amount: Number(data.amount),
		},
	};
}

export async function saveContingencyAction(
	rawInput: z.input<typeof contingencySchema>,
): Promise<ActionResult> {
	const actor = await requirePermission("pricing_rules.edit");
	const parsed = contingencySchema.safeParse(rawInput);
	if (!parsed.success) {
		return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid contingency." };
	}

	const supabase = await createClient();
	const { error } = await supabase.from("overhead_settings").upsert(
		{
			id: 1,
			contingency_percent: parsed.data.percent,
			updated_by: actor.id,
		},
		{ onConflict: "id" },
	);

	if (error) {
		return { ok: false, message: error.message };
	}

	await supabase.from("audit_logs").insert({
		actor_id: actor.id,
		action: "contingency.updated",
		entity_type: "overhead_settings",
		entity_id: "1",
		new_values: { contingency_percent: parsed.data.percent },
	});

	revalidatePath("/cost-rates/other");
	return { ok: true };
}
