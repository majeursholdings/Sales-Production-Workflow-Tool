import SettingsNumberingPage from "@/components/pages/settings/numbering";
import { requireOwner } from "@/lib/session";

export default async function NumberingPage() {
	await requireOwner();
	return <SettingsNumberingPage />;
}
