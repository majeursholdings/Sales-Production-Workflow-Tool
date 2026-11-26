import dayjs from "dayjs";
import TaxPanel from "@/components/settings/company/taxPanel";
import { getCompanySettings } from "@/lib/data/companySettings";
import { hasPermission } from "@/lib/roles";
import { getCurrentUser } from "@/lib/session";

export default async function SettingsTaxPage() {
	const [user, settings] = await Promise.all([getCurrentUser(), getCompanySettings()]);
	return (
		<TaxPanel
			settings={settings}
			canEdit={hasPermission(user.roleKey, "settings.company")}
			canEditRate={hasPermission(user.roleKey, "pricing_rules.edit")}
			now={dayjs().format("YYYY-MM-DDTHH:mm:ss")}
		/>
	);
}
