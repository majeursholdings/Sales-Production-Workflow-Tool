import PageTitle from "@/components/layout/pageTitle";
import PageWrapper from "@/components/layout/pageWrapper";
import { Button } from "@/components/common/buttons";
import { Plus } from "lucide-react";

export default function FurnitureTypesPage() {
	return (
		<PageWrapper>
			<PageTitle
				pageTitle="Furniture types"
				pageDescription="The furniture you make and the parts each type is built from."
				actions={
					<>
						<Button variant="primary">
							<Plus />
							New furniture type
						</Button>
					</>
				}
			/>
		</PageWrapper>
	);
}
