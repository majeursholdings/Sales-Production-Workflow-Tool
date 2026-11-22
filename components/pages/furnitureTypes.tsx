import FurnitureTypesView from "@/components/furniture/furnitureTypesView";
import PageWrapper from "@/components/layout/pageWrapper";
import type {
	FurnitureAccess,
	FurnitureCategory,
	FurnitureTemplate,
	FurnitureTypeSummary,
	InventoryPart,
} from "@/lib/furnitureTypes";

export default function FurnitureTypesPage(props: {
	groups: { category: FurnitureCategory; types: FurnitureTypeSummary[] }[];
	templates: Record<string, FurnitureTemplate>;
	inventory: InventoryPart[];
	access: FurnitureAccess;
}) {
	return (
		<PageWrapper>
			<FurnitureTypesView {...props} />
		</PageWrapper>
	);
}
