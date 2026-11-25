import dayjs from "dayjs";
import CompanyDetailsPanel from "@/components/settings/company/companyDetailsPanel";
import { getCompanySettings } from "@/lib/companySettings";
import { isOwnerAppRole } from "@/lib/roles";
import { getCurrentUser } from "@/lib/session";

export default async function SettingsCompanyPage() {
	const [user, settings] = await Promise.all([getCurrentUser(), getCompanySettings()]);
	return (
		<CompanyDetailsPanel
			initial={settings}
			userName={user.name}
			canEdit={isOwnerAppRole(user.roleKey)}
			now={dayjs().format("YYYY-MM-DDTHH:mm:ss")}
		/>
	);
}
