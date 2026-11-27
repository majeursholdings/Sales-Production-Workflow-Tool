import dayjs from "dayjs";
import PageWrapper from "@/components/layout/pageWrapper";
import NewPurchaseOrderContent from "@/components/purchaseOrders/newPurchaseOrderContent";
import { getInventory, getPurchaseOrders, getSupplierCatalog } from "@/lib/data/procurement";
import { getCompanyConfig } from "@/lib/data/companySettings";
import { requireRouteAccess } from "@/lib/session";

export default async function NewPurchaseOrderPage({
	searchParams,
}: {
	searchParams: Promise<{ supplier?: string }>;
}) {
	const user = await requireRouteAccess("/purchase-orders");
	const [{ supplier }, orders, inventory, catalog, settings] = await Promise.all([
		searchParams,
		getPurchaseOrders(),
		getInventory(),
		getSupplierCatalog(),
		getCompanyConfig(),
	]);
	const poApprovalLimit = settings.tax.poApprovalLimit;
	return (
		<PageWrapper>
			<NewPurchaseOrderContent
				orders={orders}
				inventory={inventory}
				catalog={catalog}
				today={dayjs().format("YYYY-MM-DD")}
				userName={user.name}
				approvalLimit={poApprovalLimit}
				addresses={settings.addresses}
				initialSupplierId={supplier}
			/>
		</PageWrapper>
	);
}
