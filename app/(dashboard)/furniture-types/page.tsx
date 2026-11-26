import type { Metadata } from "next";
import FurnitureTypesPageView from "@/components/pages/furnitureTypes";
import { getFurnitureCatalog, getOtherCostOptions } from "@/lib/data/furnitureTypes";
import { furnitureAccess } from "@/lib/furnitureTypes";
import { requireRouteAccess } from "@/lib/session";

export const metadata: Metadata = { title: "Furniture types" };

export default async function FurnitureTypesPage() {
	const user = await requireRouteAccess("/furniture-types");
	const access = furnitureAccess(user.roleKey);
	const [catalog, otherCosts] = await Promise.all([
		getFurnitureCatalog(),
		access.canEditDetails ? getOtherCostOptions() : Promise.resolve([]),
	]);
	return <FurnitureTypesPageView catalog={catalog} otherCosts={otherCosts} access={access} />;
}
