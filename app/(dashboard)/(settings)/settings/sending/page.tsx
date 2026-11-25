import SettingsSendingPage from "@/components/pages/settings/sending";
import { requireRouteAccess } from "@/lib/session";

export default async function SendingPage() {
	await requireRouteAccess("/settings/sending");
	return <SettingsSendingPage />;
}
