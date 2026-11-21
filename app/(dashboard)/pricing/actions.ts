"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/session";
import { createClient } from "@/utils/supabase/server";

export type ActionResult = { ok: true } | { ok: false; message: string };

const updateMarkupsSchema = z.array(
	z.object({
		id: z.string().min(1),
		markup: z.number().min(0),
	}),
);

export async function saveCategoryMarkupsAction(
	rawChanges: z.input<typeof updateMarkupsSchema>,
): Promise<ActionResult> {
	const actor = await requirePermission("pricing_rules.edit");
	const parsed = updateMarkupsSchema.safeParse(rawChanges);
	if (!parsed.success || parsed.data.length === 0) {
		return { ok: false, message: "No valid markup changes to save." };
	}

	const supabase = await createClient();
	const ids = parsed.data.map((c) => c.id);

	const { data: existingRows, error: fetchError } = await supabase
		.from("markup_categories")
		.select("id, name, markup_percent, ceiling_percent")
		.in("id", ids);

	if (fetchError || !existingRows) {
		return { ok: false, message: fetchError?.message ?? "Could not load markup categories." };
	}

	const byId = new Map(existingRows.map((r) => [r.id, r]));

	for (const change of parsed.data) {
		const current = byId.get(change.id);
		if (!current) {
			return { ok: false, message: `Unknown category: ${change.id}` };
		}
		if (change.markup > Number(current.ceiling_percent)) {
			return {
				ok: false,
				message: `${current.name} markup (${change.markup}%) exceeds the ${current.ceiling_percent}% ceiling.`,
			};
		}
	}

	const actorLabel = `${actor.name} (${actor.role})`;

	for (const change of parsed.data) {
		const current = byId.get(change.id)!;
		const oldMarkup = Number(current.markup_percent);
		if (oldMarkup === change.markup) continue;

		const { error: updateError } = await supabase
			.from("markup_categories")
			.update({ markup_percent: change.markup })
			.eq("id", change.id);

		if (updateError) {
			return { ok: false, message: updateError.message };
		}

		const summary = `${current.name} markup ${oldMarkup}% → ${change.markup}%`;

		await Promise.all([
			supabase.from("pricing_history").insert({
				summary,
				actor_id: actor.id,
				actor_label: actorLabel,
			}),
			supabase.from("audit_logs").insert({
				actor_id: actor.id,
				action: "pricing.markup_changed",
				entity_type: "markup_category",
				entity_id: change.id,
				old_values: { markup_percent: oldMarkup },
				new_values: { markup_percent: change.markup },
			}),
		]);
	}

	revalidatePath("/pricing");
	return { ok: true };
}
