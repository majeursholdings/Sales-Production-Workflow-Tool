"use server";

import { z } from "zod";
import { fail, userWith, type ActionResult } from "@/lib/actionResult";
import type { DesignResult } from "@/lib/customDesign";
import { runPartsAgent } from "@/lib/partsAgent";
import { isValidStorageUrl, MAX_PHOTOS_PER_UPLOAD } from "@/lib/storage";
import { createClient } from "@/utils/supabase/server";

const buildSchema = z
	.object({
		scope: z.enum(["new", "addition"]),
		targetId: z.uuid().nullable().default(null),
		images: z
			.array(
				z.object({
					src: z
						.string()
						.trim()
						.refine((u) => isValidStorageUrl(u, "cost-requests"), "Invalid photo URL."),
					alt: z.string().trim().max(200).default(""),
				}),
			)
			.min(1, "Add at least one photo. The agent builds the parts list from what it can see.")
			.max(MAX_PHOTOS_PER_UPLOAD, `Add up to ${MAX_PHOTOS_PER_UPLOAD} photos.`),
		description: z.string().trim().max(2000).default(""),
		size: z.string().trim().max(120).default(""),
		quantity: z.number().int().positive("Quantity must be at least 1").max(999),
	})
	.refine((v) => v.scope === "new" || v.targetId, {
		message: "Pick the piece this adds to.",
		path: ["targetId"],
	});

export type BuildPartsList = z.input<typeof buildSchema>;

/** Sends the client's photos and notes to the parts agent and returns its parts list. */
export async function buildPartsListAction(
	raw: BuildPartsList,
): Promise<ActionResult<DesignResult>> {
	const actor = await userWith("quotes.create");
	if (!actor) return fail("You don't have permission to build custom designs.");
	const parsed = buildSchema.safeParse(raw);
	if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the form.");
	const r = parsed.data;

	let target: { id: string; name: string; categoryId: string } | null = null;
	if (r.scope === "addition" && r.targetId) {
		const supabase = await createClient();
		const { data, error } = await supabase
			.from("furniture_types")
			.select("id, name, category_id")
			.eq("id", r.targetId)
			.maybeSingle();
		if (error) return fail(error.message);
		if (!data) return fail("That furniture type no longer exists. Pick another.");
		target = {
			id: data.id as string,
			name: data.name as string,
			categoryId: data.category_id as string,
		};
	}

	return runPartsAgent({
		scope: r.scope,
		target,
		images: r.images,
		description: r.description,
		size: r.size,
		quantity: r.quantity,
	});
}
