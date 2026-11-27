"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, userWith, type ActionResult } from "@/lib/actionResult";
import { addressLine, countryName, type PostalAddress } from "@/lib/address";
import { postalAddressSchema } from "@/lib/address/schema";
import { joinName } from "@/lib/names";
import { nameSchemaParts } from "@/lib/nameSchema";
import { scoreOf, supplierId as slugFor } from "@/lib/suppliers";
import { createClient } from "@/utils/supabase/server";

const NO_ACCESS = "You don't have permission to change suppliers.";

const detailsSchema = z.object({
	business: z.string().trim().min(2, "Business name is required"),
	contactTitle: nameSchemaParts.title,
	contactFirstName: nameSchemaParts.firstName,
	contactSurname: nameSchemaParts.surname,
	addressParts: postalAddressSchema,
	phone: z.string().trim().default(""),
	email: z.string().trim().default(""),
	bankDetails: z.object({
		bank: z.string().trim().default(""),
		accountNumber: z.string().trim().default(""),
		accountName: z.string().trim().default(""),
	}),
	notes: z.string().trim().default(""),
});

const materialSchema = z.object({
	sku: z.string().trim().min(1),
	price: z.number().nonnegative(),
	leadDays: z.number().int().nonnegative(),
	minOrder: z.string().trim().default(""),
});

const rating = z.number().int().min(1).max(5);
const ratingSchema = materialSchema.omit({ sku: true }).extend({
	ratingNote: z.string().trim().default(""),
	ratings: z.object({ quality: rating, reliability: rating, availability: rating }),
	preferred: z.boolean(),
});

/** The short area for the suppliers table, e.g. "Sango-Ota, Ogun". */
const areaOf = (a: PostalAddress) =>
	[a.area || a.city, a.state || (a.area ? a.city : "")].filter(Boolean).join(", ") ||
	countryName(a.country);

function revalidateProcurement(id?: string) {
	revalidatePath("/suppliers");
	if (id) revalidatePath(`/suppliers/${id}`);
	revalidatePath("/inventory");
	revalidatePath("/purchase-orders");
}

const detailsColumns = (d: z.output<typeof detailsSchema>) => ({
	business: d.business,
	contact: joinName({ firstName: d.contactFirstName, surname: d.contactSurname }),
	contact_title: d.contactTitle,
	contact_first_name: d.contactFirstName,
	contact_surname: d.contactSurname,
	address: addressLine(d.addressParts),
	address_parts: d.addressParts,
	area: areaOf(d.addressParts),
	phone: d.phone,
	email: d.email,
	bank_name: d.bankDetails.bank,
	account_number: d.bankDetails.accountNumber,
	account_name: d.bankDetails.accountName,
	notes: d.notes,
});

export async function createSupplierAction(
	raw: z.input<typeof detailsSchema>,
): Promise<ActionResult<{ id: string }>> {
	const actor = await userWith("materials.edit");
	if (!actor) return fail(NO_ACCESS);
	const parsed = detailsSchema.safeParse(raw);
	if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid supplier.");

	const supabase = await createClient();
	const { data: existing } = await supabase.from("suppliers").select("id");
	const id = slugFor(parsed.data.business, new Set((existing ?? []).map((s) => s.id)));

	const { error } = await supabase
		.from("suppliers")
		.insert({ id, ...detailsColumns(parsed.data), created_by: actor.id });
	if (error) return fail(error.message);

	await supabase.from("audit_logs").insert({
		actor_id: actor.id,
		action: "supplier.created",
		entity_type: "supplier",
		entity_id: id,
		new_values: { business: parsed.data.business },
	});

	revalidateProcurement();
	return { ok: true, data: { id } };
}

export async function updateSupplierAction(
	id: string,
	raw: z.input<typeof detailsSchema>,
): Promise<ActionResult> {
	const actor = await userWith("materials.edit");
	if (!actor) return fail(NO_ACCESS);
	const parsed = detailsSchema.safeParse(raw);
	if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid supplier.");

	const supabase = await createClient();
	const { data: before } = await supabase
		.from("suppliers")
		.select("bank_name, account_number")
		.eq("id", id)
		.maybeSingle();

	const { error } = await supabase
		.from("suppliers")
		.update(detailsColumns(parsed.data))
		.eq("id", id);
	if (error) return fail(error.message);

	const bankChanged =
		before &&
		(before.bank_name !== parsed.data.bankDetails.bank ||
			before.account_number !== parsed.data.bankDetails.accountNumber);
	await supabase.from("audit_logs").insert({
		actor_id: actor.id,
		action: bankChanged ? "supplier.bank_changed" : "supplier.updated",
		entity_type: "supplier",
		entity_id: id,
		new_values: { business: parsed.data.business },
	});

	revalidateProcurement(id);
	return { ok: true };
}

/** Deactivates the supplier so past purchase orders keep its name, and drops its materials. */
export async function deleteSupplierAction(id: string): Promise<ActionResult> {
	const actor = await userWith("materials.edit");
	if (!actor) return fail(NO_ACCESS);

	const supabase = await createClient();
	const { error: linkError } = await supabase
		.from("supplier_materials")
		.delete()
		.eq("supplier_id", id);
	if (linkError) return fail(linkError.message);

	const { error } = await supabase.from("suppliers").update({ is_active: false }).eq("id", id);
	if (error) return fail(error.message);

	await supabase.from("audit_logs").insert({
		actor_id: actor.id,
		action: "supplier.deleted",
		entity_type: "supplier",
		entity_id: id,
	});

	revalidateProcurement(id);
	return { ok: true };
}

export async function addSupplierMaterialAction(
	id: string,
	raw: z.input<typeof materialSchema>,
): Promise<ActionResult> {
	if (!(await userWith("materials.edit"))) return fail(NO_ACCESS);
	const parsed = materialSchema.safeParse(raw);
	if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid material.");

	const supabase = await createClient();
	const { error } = await supabase.from("supplier_materials").insert({
		supplier_id: id,
		sku: parsed.data.sku,
		price: parsed.data.price,
		lead_days: parsed.data.leadDays,
		min_order: parsed.data.minOrder,
	});
	if (error) return fail(error.message);

	revalidateProcurement(id);
	return { ok: true };
}

export async function removeSupplierMaterialAction(id: string, sku: string): Promise<ActionResult> {
	if (!(await userWith("materials.edit"))) return fail(NO_ACCESS);

	const supabase = await createClient();
	const { error } = await supabase
		.from("supplier_materials")
		.delete()
		.eq("supplier_id", id)
		.eq("sku", sku);
	if (error) return fail(error.message);

	revalidateProcurement(id);
	return { ok: true };
}

/** Makes `id` the one preferred supplier for `sku`, or clears it when `id` is null. */
async function setPreferred(sku: string, id: string | null) {
	const supabase = await createClient();
	const { error: clearError } = await supabase
		.from("supplier_materials")
		.update({ is_preferred: false })
		.eq("sku", sku)
		.eq("is_preferred", true);
	if (clearError) return clearError.message;
	if (!id) return null;

	const { error } = await supabase
		.from("supplier_materials")
		.update({ is_preferred: true })
		.eq("sku", sku)
		.eq("supplier_id", id);
	return error?.message ?? null;
}

export async function setPreferredSupplierAction(
	sku: string,
	id: string | null,
): Promise<ActionResult> {
	if (!(await userWith("materials.edit"))) return fail(NO_ACCESS);
	const error = await setPreferred(sku, id);
	if (error) return fail(error);
	revalidateProcurement(id ?? undefined);
	return { ok: true };
}

export async function rateSupplierMaterialAction(
	id: string,
	sku: string,
	raw: z.input<typeof ratingSchema>,
): Promise<ActionResult> {
	const actor = await userWith("materials.edit");
	if (!actor) return fail(NO_ACCESS);
	const parsed = ratingSchema.safeParse(raw);
	if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid rating.");
	const d = parsed.data;

	const supabase = await createClient();
	const { data: before, error } = await supabase
		.from("supplier_materials")
		.update({
			price: d.price,
			lead_days: d.leadDays,
			min_order: d.minOrder,
			quality: d.ratings.quality,
			reliability: d.ratings.reliability,
			availability: d.ratings.availability,
			rating_note: d.ratingNote,
			rated_on: new Date().toISOString().slice(0, 10),
			rated_by: actor.name,
		})
		.eq("supplier_id", id)
		.eq("sku", sku)
		.select("is_preferred")
		.single();
	if (error) return fail(error.message);

	let preferError: string | null = null;
	if (d.preferred) {
		preferError = await setPreferred(sku, id);
	} else if (before?.is_preferred) {
		// No longer preferred here: hand it to the best-scoring other supplier
		const { data: others } = await supabase
			.from("supplier_materials")
			.select("supplier_id, quality, reliability, availability")
			.eq("sku", sku)
			.neq("supplier_id", id);
		const best = (others ?? [])
			.map((o) => ({
				id: o.supplier_id as string,
				score:
					scoreOf(
						o.quality === null
							? null
							: {
									quality: o.quality,
									reliability: o.reliability,
									availability: o.availability,
								},
					) ?? -1,
			}))
			.sort((a, b) => b.score - a.score)[0];
		preferError = await setPreferred(sku, best?.id ?? null);
	}
	if (preferError) return fail(preferError);

	revalidateProcurement(id);
	return { ok: true };
}
