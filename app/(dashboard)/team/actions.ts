"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { APP_ROLES, isOwnerAppRole, type AppRole } from "@/lib/roles";
import { requireOwner } from "@/lib/session";
import type { TeamMember } from "@/lib/team";
import { createAdminClient, hasAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";

export type TeamActionResult<T = undefined> =
	(T extends undefined ? { ok: true } : { ok: true; data: T }) | { ok: false; message: string };

const roleSchema = z.enum(APP_ROLES);

const createMemberSchema = z
	.object({
		fullName: z.string().trim().min(2, "Full name is required"),
		email: z.string().trim().email("Enter a valid work email"),
		phone: z.string().trim().optional().default(""),
		role: roleSchema,
		mode: z.enum(["password", "invite"]),
		password: z.string().optional(),
	})
	.superRefine((data, ctx) => {
		if (data.mode === "password" && (!data.password || data.password.length < 12)) {
			ctx.addIssue({
				code: "custom",
				path: ["password"],
				message: "Password must be at least 12 characters",
			});
		}
	});

const updateMemberSchema = z.object({
	userId: z.string().uuid("Invalid user ID"),
	fullName: z.string().trim().min(2, "Full name is required"),
	phone: z.string().trim().optional().default(""),
	role: roleSchema,
});

const toggleActiveSchema = z.object({
	userId: z.string().uuid("Invalid user ID"),
	isActive: z.boolean(),
});

async function getOrigin(): Promise<string> {
	const h = await headers();
	const host = h.get("x-forwarded-host") || h.get("host");
	const proto = h.get("x-forwarded-proto") || "http";
	return host ? `${proto}://${host}` : "";
}

async function writeAuditLog(params: {
	actorId: string;
	action: string;
	entityId: string;
	oldValues?: Record<string, unknown> | null;
	newValues?: Record<string, unknown> | null;
}) {
	const supabase = await createClient();
	await supabase.from("audit_logs").insert({
		actor_id: params.actorId,
		action: params.action,
		entity_type: "user",
		entity_id: params.entityId,
		old_values: params.oldValues ?? null,
		new_values: params.newValues ?? null,
	});
}

export async function createTeamMemberAction(
	rawInput: z.input<typeof createMemberSchema>,
): Promise<TeamActionResult<TeamMember>> {
	const actor = await requireOwner();

	if (!hasAdminClient()) {
		return {
			ok: false,
			message:
				"Add SUPABASE_SECRET_KEY to your server environment (.env.local) before creating accounts from Team & access.",
		};
	}

	const parsed = createMemberSchema.safeParse(rawInput);
	if (!parsed.success) {
		return {
			ok: false,
			message: parsed.error.issues[0]?.message ?? "Please check the form fields.",
		};
	}

	const { fullName, email, phone, role, mode, password } = parsed.data;
	const admin = createAdminClient();
	const origin = await getOrigin();

	let userId: string;
	let createdAt = new Date().toISOString();

	if (mode === "invite") {
		const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
			data: { full_name: fullName, phone },
			redirectTo: origin
				? `${origin}/auth/confirm?next=${encodeURIComponent("/forgot-password?mode=reset")}`
				: undefined,
		});
		if (error || !data.user) {
			return { ok: false, message: error?.message ?? "Could not send invite email." };
		}
		userId = data.user.id;
		createdAt = data.user.created_at ?? createdAt;

		await admin.auth.admin.updateUserById(userId, {
			app_metadata: { role },
		});
	} else {
		const { data, error } = await admin.auth.admin.createUser({
			email,
			password: password!,
			email_confirm: true,
			user_metadata: { full_name: fullName, phone },
			app_metadata: { role },
		});
		if (error || !data.user) {
			return { ok: false, message: error?.message ?? "Could not create user account." };
		}
		userId = data.user.id;
		createdAt = data.user.created_at ?? createdAt;
	}

	const { error: profileError } = await admin.from("profiles").upsert(
		{
			id: userId,
			full_name: fullName,
			email,
			phone,
			is_active: true,
		},
		{ onConflict: "id" },
	);
	if (profileError) {
		return { ok: false, message: profileError.message };
	}

	const { error: roleError } = await admin.from("user_roles").upsert(
		{
			user_id: userId,
			role,
			assigned_by: actor.id,
		},
		{ onConflict: "user_id" },
	);
	if (roleError) {
		return { ok: false, message: roleError.message };
	}

	await writeAuditLog({
		actorId: actor.id,
		action: "user.created",
		entityId: userId,
		newValues: { full_name: fullName, email, role, mode },
	});

	revalidatePath("/team");

	return {
		ok: true,
		data: {
			id: userId,
			fullName,
			email,
			phone,
			role,
			isActive: true,
			createdAt,
		},
	};
}

export async function updateTeamMemberAction(
	rawInput: z.input<typeof updateMemberSchema>,
): Promise<TeamActionResult<TeamMember>> {
	const actor = await requireOwner();

	const parsed = updateMemberSchema.safeParse(rawInput);
	if (!parsed.success) {
		return {
			ok: false,
			message: parsed.error.issues[0]?.message ?? "Please check the form fields.",
		};
	}

	const { userId, fullName, phone, role } = parsed.data;
	const supabase = await createClient();

	const [{ data: existingProfile }, { data: existingRole }] = await Promise.all([
		supabase
			.from("profiles")
			.select("id, full_name, email, phone, is_active, created_at")
			.eq("id", userId)
			.single(),
		supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
	]);

	if (!existingProfile) {
		return { ok: false, message: "Team member not found." };
	}

	const previousRole = (existingRole?.role as AppRole | undefined) ?? null;

	// Never leave the workspace without an active MD or GM.
	if (previousRole && isOwnerAppRole(previousRole) && !isOwnerAppRole(role)) {
		const { data: activeOwners } = await supabase
			.from("user_roles")
			.select("user_id")
			.in("role", ["md", "gm"]);

		const otherOwnerIds = (activeOwners ?? [])
			.map((r) => r.user_id)
			.filter((id) => id !== userId);

		if (otherOwnerIds.length === 0) {
			return {
				ok: false,
				message: "At least one Managing Director or General Manager must remain assigned.",
			};
		}
	}

	const { error: profileError } = await supabase
		.from("profiles")
		.update({ full_name: fullName, phone })
		.eq("id", userId);

	if (profileError) {
		return { ok: false, message: profileError.message };
	}

	const { error: roleError } = await supabase.from("user_roles").upsert(
		{
			user_id: userId,
			role,
			assigned_by: actor.id,
		},
		{ onConflict: "user_id" },
	);

	if (roleError) {
		return { ok: false, message: roleError.message };
	}

	if (hasAdminClient()) {
		const admin = createAdminClient();
		await admin.auth.admin.updateUserById(userId, {
			user_metadata: { full_name: fullName, phone },
			app_metadata: { role },
		});
	}

	await writeAuditLog({
		actorId: actor.id,
		action: previousRole !== role ? "user.role_changed" : "user.updated",
		entityId: userId,
		oldValues: {
			full_name: existingProfile.full_name,
			phone: existingProfile.phone,
			role: previousRole,
		},
		newValues: { full_name: fullName, phone, role },
	});

	revalidatePath("/team");

	return {
		ok: true,
		data: {
			id: existingProfile.id,
			fullName,
			email: existingProfile.email,
			phone,
			role,
			isActive: existingProfile.is_active,
			createdAt: existingProfile.created_at,
		},
	};
}

export async function setTeamMemberActiveAction(
	rawInput: z.input<typeof toggleActiveSchema>,
): Promise<TeamActionResult> {
	const actor = await requireOwner();

	const parsed = toggleActiveSchema.safeParse(rawInput);
	if (!parsed.success) {
		return { ok: false, message: "Invalid request." };
	}

	const { userId, isActive } = parsed.data;
	if (!isActive && userId === actor.id) {
		return { ok: false, message: "You cannot deactivate your own account." };
	}

	const supabase = await createClient();
	const { error } = await supabase
		.from("profiles")
		.update({ is_active: isActive })
		.eq("id", userId);

	if (error) {
		return { ok: false, message: error.message };
	}

	if (hasAdminClient()) {
		const admin = createAdminClient();
		await admin.auth.admin.updateUserById(userId, {
			ban_duration: isActive ? "none" : "876000h",
		});
	}

	await writeAuditLog({
		actorId: actor.id,
		action: isActive ? "user.reactivated" : "user.deactivated",
		entityId: userId,
		oldValues: { is_active: !isActive },
		newValues: { is_active: isActive },
	});

	revalidatePath("/team");
	return { ok: true };
}

export async function sendTeamPasswordResetAction(email: string): Promise<TeamActionResult> {
	const actor = await requireOwner();
	const parsed = z.string().trim().email().safeParse(email);
	if (!parsed.success) {
		return { ok: false, message: "Invalid email address." };
	}

	const supabase = await createClient();
	const origin = await getOrigin();
	const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
		redirectTo: origin
			? `${origin}/auth/confirm?next=${encodeURIComponent("/forgot-password?mode=reset")}`
			: undefined,
	});

	if (error) {
		return { ok: false, message: error.message };
	}

	await writeAuditLog({
		actorId: actor.id,
		action: "user.password_reset_sent",
		entityId: parsed.data,
		newValues: { email: parsed.data },
	});

	return { ok: true };
}
