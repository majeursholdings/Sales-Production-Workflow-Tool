import SettingsTradePage from "@/components/pages/settings/trade";
import { requireOwner } from "@/lib/session";

export default async function TradePage() {
	await requireOwner();
	return <SettingsTradePage />;
}
