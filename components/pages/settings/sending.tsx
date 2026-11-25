import dayjs from "dayjs";
import SendingPanel from "@/components/settings/company/sendingPanel";
import { getCompanySettings } from "@/lib/data/companySettings";
import { hasPermission } from "@/lib/roles";
import { getCurrentUser } from "@/lib/session";

export default async function SettingsSendingPage() {
	const [user, settings] = await Promise.all([getCurrentUser(), getCompanySettings()]);
	return (
		<SendingPanel
			settings={settings}
			canEdit={hasPermission(user.roleKey, "settings.company")}
			now={dayjs().format("YYYY-MM-DDTHH:mm:ss")}
		/>
	);
}
