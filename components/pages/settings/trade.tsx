import dayjs from "dayjs";
import TradePanel from "@/components/settings/company/tradePanel";
import { getClients } from "@/lib/data/clients";
import { getCompanySettings } from "@/lib/data/companySettings";
import { hasPermission } from "@/lib/roles";
import { getCurrentUser } from "@/lib/session";

export default async function SettingsTradePage() {
	const [user, settings, clients] = await Promise.all([
		getCurrentUser(),
		getCompanySettings(),
		getClients(),
	]);

	// Trade clients by tier: their tier reads "Silver · 5% off", or "Starter · …" below the first tier
	const clientCounts: Record<string, number> = {};
	for (const c of clients) {
		if (c.type !== "Trade") continue;
		const tier = c.tier.split("·")[0].trim() || "Starter";
		clientCounts[tier] = (clientCounts[tier] ?? 0) + 1;
	}

	return (
		<TradePanel
			settings={settings}
			canEdit={hasPermission(user.roleKey, "settings.company")}
			now={dayjs().format("YYYY-MM-DDTHH:mm:ss")}
			clientCounts={clientCounts}
		/>
	);
}
