import SettingsAgentPage from "@/components/pages/settings/agent";
import { requireRouteAccess } from "@/lib/session";

export default async function AgentPage() {
	await requireRouteAccess("/settings/agent");
	return <SettingsAgentPage />;
}
