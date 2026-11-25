import dayjs from "dayjs";
import SuppliersPageView from "@/components/pages/suppliers";
import { getSupplierCatalog } from "@/lib/suppliers";
import { requireRouteAccess } from "@/lib/session";

export default async function SuppliersPage() {
	await requireRouteAccess("/suppliers");
	return (
		<SuppliersPageView
			catalog={await getSupplierCatalog()}
			today={dayjs().format("YYYY-MM-DD")}
		/>
	);
}
