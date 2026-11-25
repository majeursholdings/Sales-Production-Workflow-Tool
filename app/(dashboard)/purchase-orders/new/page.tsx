import dayjs from "dayjs";
import PageWrapper from "@/components/layout/pageWrapper";
import NewPurchaseOrderContent from "@/components/purchaseOrders/newPurchaseOrderContent";
import { getInventory, getPurchaseOrders, getSupplierCatalog } from "@/lib/data/procurement";
import { requireRouteAccess } from "@/lib/session";

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
				orders={orders}
				inventory={inventory}
				catalog={catalog}
				today={dayjs().format("YYYY-MM-DD")}
				userName={user.name}
				initialSupplierId={supplier}
			/>
		</PageWrapper>
	);
}
