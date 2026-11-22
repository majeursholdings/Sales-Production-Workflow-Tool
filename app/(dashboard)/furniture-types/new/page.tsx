import type { Metadata } from "next";
import NewFurnitureTypeForm from "@/components/furniture/newFurnitureTypeForm";
import { getInventoryParts } from "@/lib/furnitureTypes";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = { title: "New furniture type" };

export default async function NewFurnitureTypePage() {
	// Only procurement and the MD/GM create furniture types
	await requireRole(["md", "gm", "procurement"]);
	return <NewFurnitureTypeForm inventory={await getInventoryParts()} />;
}
