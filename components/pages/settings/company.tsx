import dayjs from "dayjs";
import CompanyDetailsPanel from "@/components/settings/company/companyDetailsPanel";
import { getCompanySettings } from "@/lib/data/companySettings";
import { hasPermission } from "@/lib/roles";
import { getCurrentUser } from "@/lib/session";

export default async function SettingsCompanyPage() {
	const [user, settings] = await Promise.all([getCurrentUser(), getCompanySettings()]);
	return (
		<CompanyDetailsPanel
			settings={settings}
			canEdit={hasPermission(user.roleKey, "settings.company")}
			now={dayjs().format("YYYY-MM-DDTHH:mm:ss")}
		/>
	);
}
