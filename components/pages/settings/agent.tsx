import dayjs from "dayjs";
import AgentPanel from "@/components/settings/company/agentPanel";
import { getCompanySettings } from "@/lib/companySettings";
import { isOwnerAppRole } from "@/lib/roles";
import { getCurrentUser } from "@/lib/session";

export default async function SettingsAgentPage() {
	const [user, settings] = await Promise.all([getCurrentUser(), getCompanySettings()]);
	return (
		<AgentPanel
			initial={settings}
			userName={user.name}
			canEdit={isOwnerAppRole(user.roleKey)}
			now={dayjs().format("YYYY-MM-DDTHH:mm:ss")}
		/>
	);
}
