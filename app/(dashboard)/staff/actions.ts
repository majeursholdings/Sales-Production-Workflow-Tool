"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/session";
import type { StaffMember } from "@/lib/staff";
import { createClient } from "@/utils/supabase/server";

export type ActionResult<T = undefined> =
	(T extends undefined ? { ok: true } : { ok: true; data: T }) | { ok: false; message: string };

const staffSchema = z.object({
	id: z.string().uuid().optional(),
	name: z.string().trim().min(2, "Full name is required"),
	role: z.string().trim().min(1, "Role is required"),
	team: z.enum(["Production", "Non-production"]),
	phone: z.string().trim().default(""),
	email: z.string().trim().email("Enter a valid email"),
	rate: z.number().positive("Hourly rate must be above ₦0"),
	hoursPerMonth: z.number().positive("Hours per month must be above 0"),
	notes: z.string().trim().default(""),
});

export async function saveStaffMemberAction(
	rawInput: z.input<typeof staffSchema>,
): Promise<ActionResult<StaffMember>> {
	const actor = await requirePermission("pricing_rules.edit");
	const parsed = staffSchema.safeParse(rawInput);
	if (!parsed.success) {
		return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid staff details." };
	}

	const input = parsed.data;
	const supabase = await createClient();

	const payload = {
		full_name: input.name,
		role: input.role,
		team: input.team,
		phone: input.phone,
		email: input.email,
		hourly_rate: input.rate,
		hours_per_month: input.hoursPerMonth,
		notes: input.notes,
	};

	if (input.id) {
		const { data, error } = await supabase
			.from("staff_members")
			.update(payload)
			.eq("id", input.id)
			.select("id, full_name, role, team, phone, email, hourly_rate, hours_per_month, notes")
			.single();

		if (error || !data) {
			return { ok: false, message: error?.message ?? "Could not update staff member." };
		}

		await supabase.from("audit_logs").insert({
			actor_id: actor.id,
			action: "staff.updated",
			entity_type: "staff_member",
			entity_id: data.id,
			new_values: payload,
		});

		revalidatePath("/staff");
		revalidatePath("/cost-rates");

		return {
			ok: true,
			data: {
				id: data.id,
				name: data.full_name,
				role: data.role,
				team: data.team as StaffMember["team"],
				phone: data.phone ?? "",
				email: data.email ?? "",
				rate: Number(data.hourly_rate),
				hoursPerMonth: Number(data.hours_per_month),
				notes: data.notes ?? "",
			},
		};
	}

	const { data, error } = await supabase
		.from("staff_members")
		.insert(payload)
		.select("id, full_name, role, team, phone, email, hourly_rate, hours_per_month, notes")
		.single();

	if (error || !data) {
		return { ok: false, message: error?.message ?? "Could not add staff member." };
	}

	await supabase.from("audit_logs").insert({
		actor_id: actor.id,
		action: "staff.created",
		entity_type: "staff_member",
		entity_id: data.id,
		new_values: payload,
	});

	revalidatePath("/staff");
	revalidatePath("/cost-rates");

	return {
		ok: true,
		data: {
			id: data.id,
			name: data.full_name,
			role: data.role,
			team: data.team as StaffMember["team"],
			phone: data.phone ?? "",
			email: data.email ?? "",
			rate: Number(data.hourly_rate),
			hoursPerMonth: Number(data.hours_per_month),
			notes: data.notes ?? "",
		},
	};
}

export async function removeStaffMemberAction(id: string): Promise<ActionResult> {
	const actor = await requirePermission("pricing_rules.edit");
	const parsed = z.string().uuid().safeParse(id);
	if (!parsed.success) {
		return { ok: false, message: "Invalid staff ID." };
	}

	const supabase = await createClient();
	const { data: updated, error } = await supabase
		.from("staff_members")
		.update({ is_active: false })
		.eq("id", parsed.data)
		.eq("is_active", true)
		.select("id");

	if (error) {
		return { ok: false, message: error.message };
	}
	if (!updated?.length) {
		return { ok: false, message: "Staff member not found or already removed." };
	}

	await supabase.from("audit_logs").insert({
		actor_id: actor.id,
		action: "staff.removed",
		entity_type: "staff_member",
		entity_id: parsed.data,
		new_values: { is_active: false },
	});

	revalidatePath("/staff");
	revalidatePath("/cost-rates");
	return { ok: true };
}
