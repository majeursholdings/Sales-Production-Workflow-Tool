import SecurityPanel from "@/components/settings/securityPanel";
import { getCurrentUser } from "@/lib/session";

export default async function SettingsSecurityPage() {
	await getCurrentUser();
	return <SecurityPanel />;
}
