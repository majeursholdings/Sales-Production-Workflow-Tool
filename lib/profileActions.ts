"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { joinName } from "@/lib/names";
import { nameSchemaParts } from "@/lib/nameSchema";
import { resolveNotificationPrefs, type NotificationPrefs } from "@/lib/notificationPrefs";
import { getCurrentUser } from "@/lib/session";
import { createClient } from "@/utils/supabase/server";

/** The signed-in person's own profile and notification choices (row-level security applies). */

export type ProfileResult = { ok: true } | { ok: false; message: string };

const profileSchema = z.object({
	...nameSchemaParts,
	phone: z.string().trim().max(40),
	emailSignature: z.string().trim().max(2000),
});

export async function updateProfile(input: z.input<typeof profileSchema>): Promise<ProfileResult> {
	const parsed = profileSchema.safeParse(input);
	if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
	const user = await getCurrentUser();

	const supabase = await createClient();
	const { error } = await supabase
		.from("profiles")
		.update({
			title: parsed.data.title,
			first_name: parsed.data.firstName,
			surname: parsed.data.surname,
			full_name: joinName(parsed.data),
			phone: parsed.data.phone,
			email_signature: parsed.data.emailSignature,
		})
		.eq("id", user.id);
	if (error) return { ok: false, message: error.message };

	revalidatePath("/settings", "layout");
	return { ok: true };
}

export async function updateNotificationPrefs(prefs: NotificationPrefs): Promise<ProfileResult> {
	const user = await getCurrentUser();
	// Keeps only known events and true/false values
	const clean = resolveNotificationPrefs(prefs);

	const supabase = await createClient();
	const { error } = await supabase
		.from("profiles")
		.update({ notification_prefs: clean })
		.eq("id", user.id);
	if (error) return { ok: false, message: error.message };
	return { ok: true };
}
