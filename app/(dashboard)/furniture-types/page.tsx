import FurnitureTypesPageView from "@/components/pages/furnitureTypes";
import { requireRouteAccess } from "@/lib/session";

export default async function FurnitureTypesPage() {
	await requireRouteAccess("/furniture-types");
	return <FurnitureTypesPageView />;
}
