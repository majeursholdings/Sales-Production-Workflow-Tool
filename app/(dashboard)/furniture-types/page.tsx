import type { Metadata } from "next";
import FurnitureTypesPageView from "@/components/pages/furnitureTypes";
import {
	furnitureAccess,
	getFurnitureTemplates,
	getFurnitureTypeGroups,
	getInventoryParts,
} from "@/lib/furnitureTypes";
import { requireRouteAccess } from "@/lib/session";

export const metadata: Metadata = { title: "Furniture types" };

export default async function FurnitureTypesPage() {
	const user = await requireRouteAccess("/furniture-types");
	const [groups, templates, inventory] = await Promise.all([
		getFurnitureTypeGroups(),
		getFurnitureTemplates(),
		getInventoryParts(),
	]);
	return (
		<FurnitureTypesPageView
			groups={groups}
			templates={templates}
			inventory={inventory}
			access={furnitureAccess(user.roleKey)}
		/>
	);
}
