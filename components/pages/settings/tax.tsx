import dayjs from "dayjs";
import TaxPanel from "@/components/settings/company/taxPanel";
import { getCompanySettings } from "@/lib/companySettings";
import { isOwnerAppRole } from "@/lib/roles";
import { getCurrentUser } from "@/lib/session";

export default async function SettingsTaxPage() {
	const [user, settings] = await Promise.all([getCurrentUser(), getCompanySettings()]);
	return (
		<TaxPanel
			initial={settings}
			userName={user.name}
			canEdit={isOwnerAppRole(user.roleKey)}
			now={dayjs().format("YYYY-MM-DDTHH:mm:ss")}
		/>
	);
}
