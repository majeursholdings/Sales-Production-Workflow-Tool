import SettingsTradePage from "@/components/pages/settings/trade";
import { requireRouteAccess } from "@/lib/session";

export default async function TradePage() {
	await requireRouteAccess("/settings/trade");
	return <SettingsTradePage />;
}
