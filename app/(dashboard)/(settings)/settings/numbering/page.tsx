import SettingsNumberingPage from "@/components/pages/settings/numbering";
import { requireRouteAccess } from "@/lib/session";

export default async function NumberingPage() {
	await requireRouteAccess("/settings/numbering");
	return <SettingsNumberingPage />;
}
