import dayjs from "dayjs";
import InventoryPageView from "@/components/pages/inventory";
import { getInventory } from "@/lib/inventory";
import { getSupplierCatalog } from "@/lib/suppliers";
import { requireRouteAccess } from "@/lib/session";

export default async function InventoryPage() {
	await requireRouteAccess("/inventory");
	const [inventory, catalog] = await Promise.all([getInventory(), getSupplierCatalog()]);
	return (
		<InventoryPageView
			inventory={inventory}
			catalog={catalog}
			today={dayjs().format("YYYY-MM-DD")}
		/>
	);
}
