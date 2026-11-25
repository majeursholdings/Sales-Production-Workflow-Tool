import SettingsTaxPage from "@/components/pages/settings/tax";
import { requireRouteAccess } from "@/lib/session";

export default async function TaxPage() {
	await requireRouteAccess("/settings/tax");
	return <SettingsTaxPage />;
}
