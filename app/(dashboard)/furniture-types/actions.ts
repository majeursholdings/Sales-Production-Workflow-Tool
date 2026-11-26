"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { fail, userWith, type ActionResult } from "@/lib/actionResult";
import { CACHE_TAGS } from "@/lib/cacheTags";
import { categoryIdFor, type FurnitureCategory } from "@/lib/furnitureTypes";
import { hasPermission } from "@/lib/roles";
import { isValidStorageUrl } from "@/lib/storage";
import { removeStorageUrls } from "@/lib/storageServer";
import { createClient } from "@/utils/supabase/server";

const NO_ACCESS = "You don't have permission to change furniture types.";

const hoursSchema = z.object({
	name: z.string().trim().min(1),
	hours: z.number().min(0, "Hours can't be negative"),
});

const typeSchema = z.object({
	/** Null for a new type. */
	id: z.string().uuid().nullable(),
	name: z.string().trim().min(1, "Give the type a name."),
	categoryId: z.string().min(1, "Pick a category."),
	description: z.string().trim().default(""),
	buildNotes: z.string().trim().default(""),
	leadTime: z.string().trim().default(""),
	standardSize: z.string().trim().default(""),
	cratePieces: z.number().int().positive().default(1),
	status: z.enum(["draft", "published"]),
	photos: z
		.array(
			z
				.string()
				.refine(
					(u) => isValidStorageUrl(u, "furniture"),
					"Invalid furniture photo URL.",
				),
		)
		.max(6)
		.default([]),
	parts: z.array(
		z.object({ sku: z.string().min(1), qty: z.number().positive("Quantities must be more than 0") }),
	),
	labour: z.array(hoursSchema),
	machines: z.array(hoursSchema),
	extras: z.array(
		z.object({
			name: z.string().trim().min(1),
			type: z.enum(["Direct", "Indirect"]),
			amount: z.number().nonnegative(),
			costItemId: z.string().uuid().nullable().optional(),
		}),
	),
});

export type FurnitureTypeInput = z.input<typeof typeSchema>;

function revalidateCatalog() {
	updateTag(CACHE_TAGS.markupCategories);
	revalidatePath("/furniture-types", "layout");
	revalidatePath("/quotes/new", "layout");
	revalidatePath("/pricing");
}

const friendly = (message: string) =>
	message.includes("furniture_types_name_key")
		? "Another furniture type already has that name."
		: message;

/**
 * Creates or updates a furniture type and its whole template. Production (no prices)
 * can change everything except other costs, which stay as saved (none on a new type).
 */
export async function saveFurnitureTypeAction(
	raw: FurnitureTypeInput,
): Promise<ActionResult<{ id: string }>> {
	const actor = await userWith("templates.edit");
	if (!actor) return fail(NO_ACCESS);
	const parsed = typeSchema.safeParse(raw);
	if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid furniture type.");
	if (parsed.data.status === "published" && parsed.data.parts.length === 0) {
		return fail("Add at least one part before publishing.");
	}

	const costEditor = hasPermission(actor.roleKey, "quotes.view_prices");
	const input = { ...parsed.data };
	const supabase = await createClient();

	let before: Record<string, unknown> | null = null;
	let beforePhotos: string[] = [];
	if (input.id) {
		const { data, error } = await supabase
			.from("furniture_types")
			.select(
				"name, category_id, description, status, photo_urls, furniture_type_extras(name, cost_type, amount, cost_item_id, sort_order)",
			)
			.eq("id", input.id)
			.maybeSingle();
		if (error) return fail(error.message);
		if (!data) return fail("That furniture type no longer exists.");
		before = { name: data.name, category_id: data.category_id, status: data.status };
		beforePhotos = (data.photo_urls as string[] | null) ?? [];

		if (!costEditor) {
			input.extras = [...(data.furniture_type_extras ?? [])]
				.sort((a, b) => Number(a.sort_order) - Number(b.sort_order))
				.map((e) => ({
					name: e.name,
					type: e.cost_type,
					amount: Number(e.amount),
					costItemId: e.cost_item_id,
				}));
		}
	} else if (!costEditor) {
		input.extras = [];
	}

	const { data: id, error } = await supabase.rpc("save_furniture_type", {
		p_id: input.id,
		p_details: {
			name: input.name,
			category_id: input.categoryId,
			description: input.description,
			build_notes: input.buildNotes,
			lead_time: input.leadTime,
			standard_size: input.standardSize,
			crate_pieces: input.cratePieces,
			status: input.status,
			photo_urls: input.photos,
		},
		p_parts: input.parts,
		p_hours: [
			...input.labour.map((h) => ({ kind: "labour", ...h })),
			...input.machines.map((h) => ({ kind: "machine", ...h })),
		],
		p_extras: input.extras.map((e) => ({
			name: e.name,
			cost_type: e.type,
			amount: e.amount,
			cost_item_id: e.costItemId ?? null,
		})),
	});
	if (error) return fail(friendly(error.message));

	if (beforePhotos.length > 0) {
		const kept = new Set(input.photos);
		const removed = beforePhotos.filter((url) => !kept.has(url));
		await removeStorageUrls(supabase, removed, "furniture");
	}

	await supabase.from("audit_logs").insert({
		actor_id: actor.id,
		action: input.id ? "furniture_type.updated" : "furniture_type.created",
		entity_type: "furniture_type",
		entity_id: id as string,
		old_values: before,
		new_values: {
			name: input.name,
			category_id: input.categoryId,
			status: input.status,
			parts: input.parts.length,
			labour_hours: input.labour.reduce((s, h) => s + h.hours, 0),
			machine_hours: input.machines.reduce((s, h) => s + h.hours, 0),
		},
	});

	revalidateCatalog();
	return { ok: true, data: { id: id as string } };
}

export async function deleteFurnitureTypeAction(id: string): Promise<ActionResult> {
	const actor = await userWith("templates.delete");
	if (!actor) return fail("You don't have permission to delete furniture types.");

	const supabase = await createClient();
	const { data, error } = await supabase
		.from("furniture_types")
		.delete()
		.eq("id", id)
		.select("name, photo_urls");
	if (error) return fail(error.message);
	if (!data?.length) return fail("That furniture type no longer exists.");

	await removeStorageUrls(supabase, (data[0].photo_urls as string[] | null) ?? [], "furniture");

	await supabase.from("audit_logs").insert({
		actor_id: actor.id,
		action: "furniture_type.deleted",
		entity_type: "furniture_type",
		entity_id: id,
		old_values: { name: data[0].name },
	});

	revalidateCatalog();
	return { ok: true };
}

const categorySchema = z
	.object({
		name: z.string().trim().min(2, "Give the category a name."),
		markup: z.number().min(0, "Markup can't be negative").max(100),
		ceiling: z.number().min(0).max(100),
	})
	.refine((c) => c.markup <= c.ceiling, {
		message: "The markup can't be above the ceiling.",
	});

/** Adds a markup category from the new furniture type form (Pricing & margins editors only). */
export async function addFurnitureCategoryAction(
	raw: z.input<typeof categorySchema>,
): Promise<ActionResult<FurnitureCategory>> {
	const actor = await userWith("pricing_rules.edit");
	if (!actor) return fail("Only the MD, GM or Accounting can add categories.");
	const parsed = categorySchema.safeParse(raw);
	if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid category.");

	const { name, markup, ceiling } = parsed.data;
	const id = categoryIdFor(name);
	if (!id) return fail("Use letters or numbers in the category name.");

	const supabase = await createClient();
	const { data: last } = await supabase
		.from("markup_categories")
		.select("sort_order")
		.order("sort_order", { ascending: false })
		.limit(1)
		.maybeSingle();

	const { error } = await supabase.from("markup_categories").insert({
		id,
		name,
		markup_percent: markup,
		ceiling_percent: ceiling,
		sort_order: Number(last?.sort_order ?? 0) + 1,
	});
	if (error) {
		return fail(
			error.code === "23505" ? "A category with that name already exists." : error.message,
		);
	}

	await Promise.all([
		supabase.from("pricing_history").insert({
			summary: `${name} category added: ${markup}% markup, ${ceiling}% ceiling`,
			actor_id: actor.id,
			actor_label: `${actor.name} (${actor.role})`,
		}),
		supabase.from("audit_logs").insert({
			actor_id: actor.id,
			action: "pricing.category_added",
			entity_type: "markup_category",
			entity_id: id,
			new_values: { name, markup_percent: markup, ceiling_percent: ceiling },
		}),
	]);

	revalidateCatalog();
	return { ok: true, data: { id, name, markup: markup / 100, cap: ceiling / 100 } };
}
