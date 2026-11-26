import NotificationsPanel from "@/components/settings/notificationsPanel";
import { getProfileSettings } from "@/lib/profileSettings";

export default async function SettingsNotificationsPage() {
	// getProfileSettings requires a signed-in user
	const settings = await getProfileSettings();
	return <NotificationsPanel initialPrefs={settings.notifications} />;
}
