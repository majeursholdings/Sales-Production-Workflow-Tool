import dayjs from "dayjs";
import NumberingPanel from "@/components/settings/company/numberingPanel";
import { getCompanySettings } from "@/lib/data/companySettings";
import { hasPermission } from "@/lib/roles";
import { getCurrentUser } from "@/lib/session";

export default async function SettingsNumberingPage() {
	const [user, settings] = await Promise.all([getCurrentUser(), getCompanySettings()]);
	return (
		<NumberingPanel
			settings={settings}
			canEdit={hasPermission(user.roleKey, "settings.company")}
			now={dayjs().format("YYYY-MM-DDTHH:mm:ss")}
		/>
	);
}
