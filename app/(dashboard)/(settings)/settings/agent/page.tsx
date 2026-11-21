import SettingsAgentPage from "@/components/pages/settings/agent";
import { requireOwner } from "@/lib/session";

export default async function AgentPage() {
	await requireOwner();
	return <SettingsAgentPage />;
}
