import type { Metadata } from "next";
import { redirect } from "next/navigation";
import NewFurnitureTypeForm from "@/components/furniture/newFurnitureTypeForm";
import { getFurnitureCosting } from "@/lib/data/furnitureTypes";
import { furnitureAccess } from "@/lib/furnitureTypes";
import { requirePermission } from "@/lib/session";

export const metadata: Metadata = { title: "New furniture type" };

export default async function NewFurnitureTypePage() {
	// Template editors who also see prices (MD/GM) create furniture types
	const user = await requirePermission("templates.edit");
	const access = furnitureAccess(user.roleKey);
	if (!access.canEditDetails) redirect("/furniture-types");

	const { categories, inventory, rates } = await getFurnitureCosting();
	return (
		<NewFurnitureTypeForm
			categories={categories}
			inventory={inventory}
			rates={rates}
			canAddCategory={access.canAddCategory}
		/>
	);
}
