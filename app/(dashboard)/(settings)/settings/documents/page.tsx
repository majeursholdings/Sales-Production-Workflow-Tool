import SettingsDocumentsPage from "@/components/pages/settings/documents";
import { requireOwner } from "@/lib/session";

export default async function DocumentsPage() {
	await requireOwner();
	return <SettingsDocumentsPage />;
}
