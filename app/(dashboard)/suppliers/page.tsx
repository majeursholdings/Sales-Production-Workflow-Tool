import SuppliersPageView from "@/components/pages/suppliers";
import { requireRouteAccess } from "@/lib/session";

export default async function SuppliersPage() {
	await requireRouteAccess("/suppliers");
	return <SuppliersPageView />;
}
