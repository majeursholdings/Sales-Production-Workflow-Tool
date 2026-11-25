import dayjs from "dayjs";
import BankTermsPanel from "@/components/settings/company/bankTermsPanel";
import { getCompanySettings } from "@/lib/companySettings";
import { isOwnerAppRole } from "@/lib/roles";
import { getCurrentUser } from "@/lib/session";

export default async function SettingsDocumentsPage() {
	const [user, settings] = await Promise.all([getCurrentUser(), getCompanySettings()]);
	return (
		<BankTermsPanel
			initial={settings}
			userName={user.name}
			canEdit={isOwnerAppRole(user.roleKey)}
			now={dayjs().format("YYYY-MM-DDTHH:mm:ss")}
		/>
	);
}
