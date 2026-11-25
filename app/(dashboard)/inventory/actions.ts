"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, userWith, type ActionResult } from "@/lib/actionResult";
import { PART_CATEGORIES } from "@/lib/inventory";
import { createClient } from "@/utils/supabase/server";

const NO_ACCESS = "You don't have permission to change inventory.";

const partSchema = z.object({
	sku: z.string().trim().min(1, "SKU is required"),
	name: z.string().trim().min(2, "Part name is required"),
	category: z.enum(PART_CATEGORIES),
	unit: z.string().trim().min(1),
	spec: z.string().trim().default(""),
	unitCost: z.number().nonnegative(),
	inStock: z.number().nonnegative(),
	reorderLevel: z.number().nonnegative(),
	supplierId: z.string().trim().default(""),
	notes: z.string().trim().default(""),
});

function revalidateInventory() {
	revalidatePath("/inventory");
	revalidatePath("/suppliers", "layout");
	revalidatePath("/purchase-orders", "layout");
}

/** Adds a part, or updates it when the SKU exists. Cost changes are stamped and audit-logged. */
export async function savePartAction(
	raw: z.input<typeof partSchema>,
): Promise<ActionResult<{ created: boolean; costChanged: boolean }>> {
	const actor = await userWith("materials.edit");
	if (!actor) return fail(NO_ACCESS);
	const parsed = partSchema.safeParse(raw);
	if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid part.");
	const p = parsed.data;

	const supabase = await createClient();
	const { data: before, error: readError } = await supabase
		.from("parts")
		.select("unit_cost")
		.eq("sku", p.sku)
		.maybeSingle();
	if (readError) return fail(readError.message);

	const costChanged = !before || Number(before.unit_cost) !== p.unitCost;
	const columns = {
		name: p.name,
		category: p.category,
		unit: p.unit,
		spec: p.spec,
		unit_cost: p.unitCost,
		in_stock: p.inStock,
		reorder_level: p.reorderLevel,
		supplier_id: p.supplierId || null,
		notes: p.notes,
		...(costChanged && {
			cost_updated_on: new Date().toISOString().slice(0, 10),
			cost_updated_by: actor.name,
		}),
	};

	const { error } = before
		? await supabase.from("parts").update(columns).eq("sku", p.sku)
		: await supabase.from("parts").insert({ sku: p.sku, ...columns });
	if (error) return fail(error.message);

	if (before && costChanged) {
		await supabase.from("audit_logs").insert({
			actor_id: actor.id,
			action: "part.cost_changed",
			entity_type: "part",
			entity_id: p.sku,
			old_values: { unit_cost: Number(before.unit_cost) },
			new_values: { unit_cost: p.unitCost },
		});
	}

	revalidateInventory();
	return { ok: true, data: { created: !before, costChanged: Boolean(before) && costChanged } };
}

/** Archives a part (hidden from quotes and furniture types), or restores it. */
export async function setPartArchivedAction(
	sku: string,
	archived: boolean,
): Promise<ActionResult> {
	if (!(await userWith("materials.edit"))) return fail(NO_ACCESS);

	const supabase = await createClient();
	const { error } = await supabase
		.from("parts")
		.update({ is_archived: archived })
		.eq("sku", sku);
	if (error) return fail(error.message);

	revalidateInventory();
	return { ok: true };
}
