import dayjs from "dayjs";
import PageWrapper from "@/components/layout/pageWrapper";
import NewPurchaseOrderContent from "@/components/purchaseOrders/newPurchaseOrderContent";
import { getInventory } from "@/lib/inventory";
import { getPurchaseOrders } from "@/lib/purchaseOrders";
import { requireRouteAccess } from "@/lib/session";
import { getSupplierCatalog } from "@/lib/suppliers";

export default async function NewPurchaseOrderPage({
	searchParams,
}: {
	searchParams: Promise<{ supplier?: string }>;
}) {
	const user = await requireRouteAccess("/purchase-orders");
	const [{ supplier }, orders, inventory, catalog] = await Promise.all([
		searchParams,
		getPurchaseOrders(),
		getInventory(),
		getSupplierCatalog(),
	]);
	return (
		<PageWrapper>
			<NewPurchaseOrderContent
				initialOrders={orders}
				inventory={inventory}
				catalog={catalog}
				today={dayjs().format("YYYY-MM-DD")}
				userName={user.name}
				initialSupplierId={supplier}
			/>
		</PageWrapper>
	);
}
