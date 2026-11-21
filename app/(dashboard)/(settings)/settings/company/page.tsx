import SettingsCompanyPage from "@/components/pages/settings/company";
import { requireOwner } from "@/lib/session";

export default async function CompanyPage() {
	await requireOwner();
	return <SettingsCompanyPage />;
}
