import dayjs from "dayjs";
import NumberingPanel from "@/components/settings/company/numberingPanel";
import { getCompanySettings } from "@/lib/companySettings";
import { isOwnerAppRole } from "@/lib/roles";
import { getCurrentUser } from "@/lib/session";

export default async function SettingsNumberingPage() {
	const [user, settings] = await Promise.all([getCurrentUser(), getCompanySettings()]);
	return (
		<NumberingPanel
			initial={settings}
			userName={user.name}
			canEdit={isOwnerAppRole(user.roleKey)}
			now={dayjs().format("YYYY-MM-DDTHH:mm:ss")}
		/>
	);
}
