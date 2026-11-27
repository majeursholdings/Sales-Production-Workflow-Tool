import { resolveNotificationPrefs, type NotificationPrefs } from "@/lib/notificationPrefs";
import { getCurrentUser } from "@/lib/session";
import { createClient } from "@/utils/supabase/server";

export type ProfileSettings = {
	title: string;
	firstName: string;
	surname: string;
	emailSignature: string;
	notifications: NotificationPrefs;
};

/** The signed-in user's own settings (signature and notification choices). */
export async function getProfileSettings(): Promise<ProfileSettings> {
	const user = await getCurrentUser();
	const supabase = await createClient();
	const { data, error } = await supabase
		.from("profiles")
		.select("title, first_name, surname, email_signature, notification_prefs")
		.eq("id", user.id)
		.single();

	if (error) {
		throw new Error(`Failed to load your settings: ${error.message}`);
	}

	return {
		title: data.title ?? "",
		firstName: data.first_name ?? "",
		surname: data.surname ?? "",
		emailSignature: data.email_signature ?? "",
		notifications: resolveNotificationPrefs(data.notification_prefs),
	};
}
