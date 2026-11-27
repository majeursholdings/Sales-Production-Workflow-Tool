"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sendPasswordReset, sendUnlockLink } from "@/lib/email/authEmails";
import { hasPendingInvite, sendInvite } from "@/lib/invites";
import { isAccountLocked } from "@/lib/loginLock";
import { APP_ROLES, isOwnerAppRole, type AppRole } from "@/lib/roles";
import { requireOwner } from "@/lib/session";
import { joinName } from "@/lib/names";
import { nameSchemaParts } from "@/lib/nameSchema";
import type { TeamMember } from "@/lib/team";
import { createAdminClient, hasAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";

export type TeamActionResult<T = undefined> =
	(T extends undefined ? { ok: true } : { ok: true; data: T }) | { ok: false; message: string };

const roleSchema = z.enum(APP_ROLES);

const createMemberSchema = z.object({
	...nameSchemaParts,
	email: z.string().trim().toLowerCase().email("Enter a valid work email"),
	phone: z.string().trim().optional().default(""),
	role: roleSchema,
});

const updateMemberSchema = z.object({
	userId: z.string().uuid("Invalid user ID"),
	...nameSchemaParts,
	phone: z.string().trim().optional().default(""),
	role: roleSchema,
});

const toggleActiveSchema = z.object({
	userId: z.string().uuid("Invalid user ID"),
	isActive: z.boolean(),
});

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

	const { title, firstName, surname, email, phone, role } = parsed.data;
	const fullName = joinName({ firstName, surname });
	const admin = createAdminClient();

	// No password: they set their own from the invite link (lib/invites.ts)
	const { data, error } = await admin.auth.admin.createUser({
		email,
		email_confirm: true,
		user_metadata: { full_name: fullName, phone },
		app_metadata: { role },
	});
	if (error || !data.user) {
		return { ok: false, message: error?.message ?? "Could not create the account." };
	}
	const userId = data.user.id;
	const createdAt = data.user.created_at ?? new Date().toISOString();

	const { error: profileError } = await admin.from("profiles").upsert(
		{
			id: userId,
			full_name: fullName,
			title,
			first_name: firstName,
			surname,
			email,
			phone,
			is_active: true,
			// Email codes are everyone's default two-step
			two_step_email: true,
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
		newValues: { full_name: fullName, email, role },
	});

	const sent = await sendInvite(userId, email, fullName);
	revalidatePath("/team");
	if (!sent.ok) {
		return { ok: false, message: `${fullName} was added, but ${sent.message}` };
	}

	return {
		ok: true,
		data: {
			id: userId,
			fullName,
			title,
			firstName,
			surname,
			email,
			phone,
			role,
			isActive: true,
			locked: false,
			invitePending: true,
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

	const { userId, title, firstName, surname, phone, role } = parsed.data;
	const fullName = joinName({ firstName, surname });
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
		const [{ data: owners }, { data: activeProfiles }] = await Promise.all([
			supabase.from("user_roles").select("user_id").in("role", ["md", "gm"]),
			supabase.from("profiles").select("id").eq("is_active", true),
		]);
		const activeSet = new Set((activeProfiles ?? []).map((p) => p.id as string));

		const otherActiveOwnerIds = (owners ?? [])
			.map((r) => r.user_id as string)
			.filter((id) => id !== userId && activeSet.has(id));

		if (otherActiveOwnerIds.length === 0) {
			return {
				ok: false,
				message:
					"At least one active Managing Director or General Manager must remain assigned.",
			};
		}
	}

	const { error: profileError } = await supabase
		.from("profiles")
		.update({ full_name: fullName, title, first_name: firstName, surname, phone })
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
		// When changing another user's role, revoke existing sessions so stale JWTs
		// are cleared immediately (RLS and session_state also enforce the live DB role).
		if (previousRole !== role && userId !== actor.id) {
			await admin.rpc("revoke_user_sessions", { p_user_id: userId });
		}
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
			title,
			firstName,
			surname,
			email: existingProfile.email,
			phone,
			role,
			isActive: existingProfile.is_active,
			locked: hasAdminClient() ? await isAccountLocked(existingProfile.email) : false,
			invitePending: hasAdminClient() ? await hasPendingInvite(existingProfile.id) : false,
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
	if (!isActive) {
		const [{ data: owners }, { data: activeProfiles }] = await Promise.all([
			supabase.from("user_roles").select("user_id").in("role", ["md", "gm"]),
			supabase.from("profiles").select("id").eq("is_active", true),
		]);
		const isTargetOwner = (owners ?? []).some((r) => r.user_id === userId);
		if (isTargetOwner) {
			const activeSet = new Set((activeProfiles ?? []).map((p) => p.id as string));
			const otherActiveOwners = (owners ?? [])
				.map((r) => r.user_id as string)
				.filter((id) => id !== userId && activeSet.has(id));
			if (otherActiveOwners.length === 0) {
				return {
					ok: false,
					message:
						"At least one active Managing Director or General Manager must remain active.",
				};
			}
		}
	}

	const { data: updatedRows, error } = await supabase
		.from("profiles")
		.update({ is_active: isActive })
		.eq("id", userId)
		.select("id");

	if (error) {
		return { ok: false, message: error.message };
	}
	if (!updatedRows?.length) {
		return { ok: false, message: "Team member not found." };
	}

	if (hasAdminClient()) {
		const admin = createAdminClient();
		await admin.auth.admin.updateUserById(userId, {
			ban_duration: isActive ? "none" : "876000h",
		});
		// Sign them out everywhere now (the proxy also refuses inactive accounts on every request)
		if (!isActive) await admin.rpc("revoke_user_sessions", { p_user_id: userId });
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

	const sent = await sendPasswordReset(parsed.data.toLowerCase());
	if (!sent.ok) return sent;

	await writeAuditLog({
		actorId: actor.id,
		action: "user.password_reset_sent",
		entityId: parsed.data,
		newValues: { email: parsed.data },
	});

	return { ok: true };
}

/**
 * Unlocks an account locked after 5 wrong passwords and emails the person a
 * one-time sign-in link. It lands on Security settings, which asks whether the
 * lockout was them; if not, they must set a new, stronger password. The link
 * counts as their email code; an authenticator app is still asked for.
 */
export async function unlockTeamMemberAction(userId: string): Promise<TeamActionResult> {
	const actor = await requireOwner();
	const parsed = z.string().uuid().safeParse(userId);
	if (!parsed.success) return { ok: false, message: "Invalid request." };
	if (!hasAdminClient()) {
		return { ok: false, message: "Add SUPABASE_SECRET_KEY to unlock accounts." };
	}

	const admin = createAdminClient();
	const { data: profile } = await admin
		.from("profiles")
		.select("email, is_active")
		.eq("id", parsed.data)
		.maybeSingle();
	if (!profile?.email) return { ok: false, message: "That person no longer exists." };
	if (!profile.is_active) {
		return { ok: false, message: "Restore their access first, then unlock the account." };
	}
	const email = profile.email.toLowerCase();

	await Promise.all([
		admin.from("login_attempts").delete().eq("email", email),
		// Once in, they're asked whether the lockout was them (Security settings)
		admin.from("lockout_reviews").upsert({ user_id: parsed.data }),
	]);

	const sent = await sendUnlockLink(email);

	await writeAuditLog({
		actorId: actor.id,
		action: "user.unlocked",
		entityId: parsed.data,
		newValues: { email, link_sent: sent.ok },
	});
	revalidatePath("/team");

	if (!sent.ok) {
		return {
			ok: false,
			message: `Unlocked, but the sign-in link couldn't be sent (${sent.message}). They can sign in with their password, or send them a password reset.`,
		};
	}
	return { ok: true };
}

/** Sends a fresh invite link (48 hours) to someone who hasn't set a password yet. */
export async function resendInviteAction(userId: string): Promise<TeamActionResult> {
	const actor = await requireOwner();
	const parsed = z.string().uuid().safeParse(userId);
	if (!parsed.success) return { ok: false, message: "Invalid request." };
	if (!hasAdminClient())
		return { ok: false, message: "Add SUPABASE_SECRET_KEY to send invites." };

	const admin = createAdminClient();
	const { data } = await admin.auth.admin.getUserById(parsed.data);
	const user = data.user;
	if (!user?.email) return { ok: false, message: "That person no longer exists." };
	if (!(await hasPendingInvite(user.id))) {
		return { ok: false, message: "They've already set up their account." };
	}

	const { data: profile } = await admin
		.from("profiles")
		.select("full_name")
		.eq("id", user.id)
		.maybeSingle();
	const sent = await sendInvite(user.id, user.email, profile?.full_name ?? "");
	if (!sent.ok) return sent;
	await writeAuditLog({
		actorId: actor.id,
		action: "user.invite_resent",
		entityId: user.id,
		newValues: { email: user.email },
	});
	return { ok: true };
}
