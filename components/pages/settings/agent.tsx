import dayjs from "dayjs";
import AgentPanel from "@/components/settings/company/agentPanel";
import { getCompanySettings } from "@/lib/data/companySettings";
import { hasPermission } from "@/lib/roles";
import { getCurrentUser } from "@/lib/session";

export default async function SettingsAgentPage() {
	const [user, settings] = await Promise.all([getCurrentUser(), getCompanySettings()]);
	return (
		<AgentPanel
			settings={settings}
			canEdit={hasPermission(user.roleKey, "settings.company")}
			now={dayjs().format("YYYY-MM-DDTHH:mm:ss")}
		/>
	);
}
