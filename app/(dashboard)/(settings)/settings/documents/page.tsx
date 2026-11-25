import SettingsDocumentsPage from "@/components/pages/settings/documents";
import { requireRouteAccess } from "@/lib/session";

export default async function DocumentsPage() {
	await requireRouteAccess("/settings/documents");
	return <SettingsDocumentsPage />;
}
