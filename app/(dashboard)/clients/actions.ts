"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { normalizeNigerianPhone } from "@/components/forms/form.validators";
import type { Client, ClientType } from "@/lib/clients";
import { requireOwner, requireRouteAccess } from "@/lib/session";
import { createClient } from "@/utils/supabase/server";

export type ActionResult<T = undefined> =
	(T extends undefined ? { ok: true } : { ok: true; data: T }) | { ok: false; message: string };

const createClientSchema = z.object({
	name: z.string().trim().min(2, "Full name is required"),
	phone: z.string().trim().default(""),
	email: z.string().trim().default(""),
	type: z.enum(["Individual", "Trade"]),
	company: z.string().trim().default(""),
	location: z.string().trim().default(""),
	birthday: z.string().trim().default(""),
	preferredContact: z.string().trim().default("WhatsApp"),
	source: z.string().trim().default("Referral"),
	sourceDetail: z.string().trim().default(""),
	notes: z.string().trim().default(""),
});

export async function createClientAction(
	rawInput: z.input<typeof createClientSchema>,
): Promise<ActionResult<Client>> {
	const actor = await requireRouteAccess("/clients");
	const parsed = createClientSchema.safeParse(rawInput);
	if (!parsed.success) {
		return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid client details." };
	}

	const input = parsed.data;
	const phoneKey = normalizeNigerianPhone(input.phone);
	const tier = input.type === "Trade" ? "Starter · no discount yet" : "";
	const sourceLabel =
		input.source === "Social media" && input.sourceDetail ? input.sourceDetail : input.source;

	const supabase = await createClient();
	const { data, error } = await supabase
		.from("clients")
		.insert({
			name: input.name,
			phone: input.phone,
			phone_key: phoneKey,
			email: input.email,
			client_type: input.type,
			company: input.type === "Trade" ? input.company : "",
			location: input.location,
			birthday: input.birthday,
			preferred_contact: input.preferredContact,
			source: sourceLabel,
			source_detail: input.sourceDetail,
			trade_tier: tier,
			notes: input.notes,
			created_by: actor.id,
		})
		.select(
			"id, name, phone, phone_key, email, client_type, company, location, source, quotes_count, total_spent, last_activity_label, trade_tier",
		)
		.single();

	if (error || !data) {
		return { ok: false, message: error?.message ?? "Could not add client." };
	}

	await supabase.from("audit_logs").insert({
		actor_id: actor.id,
		action: "client.created",
		entity_type: "client",
		entity_id: data.id,
		new_values: { name: data.name, client_type: data.client_type, email: data.email },
	});

	revalidatePath("/clients");
	revalidatePath("/quotes/new");

	return {
		ok: true,
		data: {
			id: data.id,
			name: data.name,
			contact: [data.phone, data.email].filter(Boolean).join(" · "),
			phoneKey: data.phone_key ?? normalizeNigerianPhone(data.phone ?? ""),
			email: data.email ?? "",
			type: data.client_type as ClientType,
			company: data.company ?? "",
			location: data.location ?? "",
			source: data.source ?? "",
			quotes: Number(data.quotes_count ?? 0),
			spent: Number(data.total_spent ?? 0),
			last: data.last_activity_label ?? "No quotes yet",
			tier: data.trade_tier ?? "",
		},
	};
}

export async function deleteClientAction(clientId: string): Promise<ActionResult> {
	const actor = await requireOwner();
	const parsed = z.string().uuid().safeParse(clientId);
	if (!parsed.success) {
		return { ok: false, message: "Invalid client ID." };
	}

	const supabase = await createClient();
	const { data: deleted, error } = await supabase
		.from("clients")
		.delete()
		.eq("id", parsed.data)
		.select("id");
	if (error) {
		return { ok: false, message: error.message };
	}
	if (!deleted?.length) {
		return {
			ok: false,
			message: "Client not found or you don't have permission to delete it.",
		};
	}

	await supabase.from("audit_logs").insert({
		actor_id: actor.id,
		action: "client.deleted",
		entity_type: "client",
		entity_id: parsed.data,
	});

	revalidatePath("/clients");
	return { ok: true };
}
