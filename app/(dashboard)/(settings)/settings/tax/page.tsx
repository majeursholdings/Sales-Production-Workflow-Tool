import SettingsTaxPage from "@/components/pages/settings/tax";
import { requireOwner } from "@/lib/session";

export default async function TaxPage() {
	await requireOwner();
	return <SettingsTaxPage />;
}
