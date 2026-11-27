import dayjs from "dayjs";
import AgentPanel from "@/components/settings/company/agentPanel";
import AiProviderPanel from "@/components/settings/company/aiProviderPanel";
import { currentSession } from "@/lib/currentSession";
import { getAiSettingsView } from "@/lib/data/aiSettings";
import { getCompanySettings } from "@/lib/data/companySettings";
import { hasPermission } from "@/lib/roles";
import { getCurrentUser } from "@/lib/session";

export default async function SettingsAgentPage() {
	const [user, settings, ai, session] = await Promise.all([
		getCurrentUser(),
		getCompanySettings(),
		getAiSettingsView(),
		currentSession(),
	]);
	const canEdit = hasPermission(user.roleKey, "settings.company");
	return (
		<>
			<AiProviderPanel
				view={ai}
				canEdit={canEdit}
				hasApp={session?.hasApp ?? false}
				hasEmail={session?.hasEmail ?? false}
			/>
			<AgentPanel
				settings={settings}
				canEdit={canEdit}
				now={dayjs().format("YYYY-MM-DDTHH:mm:ss")}
			/>
		</>
	);
}
