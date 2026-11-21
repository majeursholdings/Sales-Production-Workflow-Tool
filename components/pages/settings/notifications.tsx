import NotificationsPanel from "@/components/settings/notificationsPanel";
import { getProfileSettings } from "@/lib/profileSettings";
import { getCurrentUser } from "@/lib/session";

export default async function SettingsNotificationsPage() {
	const [user, settings] = await Promise.all([getCurrentUser(), getProfileSettings()]);
	return <NotificationsPanel userId={user.id} initialPrefs={settings.notifications} />;
}
