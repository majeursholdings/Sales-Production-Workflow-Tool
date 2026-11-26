import FurnitureTypesView from "@/components/furniture/furnitureTypesView";
import PageWrapper from "@/components/layout/pageWrapper";
import type { FurnitureAccess, FurnitureCatalog, OtherCostOption } from "@/lib/furnitureTypes";

export default function FurnitureTypesPage(props: {
	catalog: FurnitureCatalog;
	otherCosts: OtherCostOption[];
	access: FurnitureAccess;
}) {
	return (
		<PageWrapper>
			<FurnitureTypesView {...props} />
		</PageWrapper>
	);
}
