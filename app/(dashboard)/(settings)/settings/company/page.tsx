import SettingsCompanyPage from "@/components/pages/settings/company";
import { requireRouteAccess } from "@/lib/session";

export default async function CompanyPage() {
	await requireRouteAccess("/settings/company");
	return <SettingsCompanyPage />;
}
