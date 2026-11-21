import InventoryPageView from "@/components/pages/inventory";
import { requireRouteAccess } from "@/lib/session";

export default async function InventoryPage() {
	await requireRouteAccess("/inventory");
	return <InventoryPageView />;
}
