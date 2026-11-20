import PageTitle from "@/components/layout/pageTitle";
import PageWrapper from "@/components/layout/pageWrapper";
import { Button } from "@/components/common/buttons";
import { Plus } from "lucide-react";

export default function InventoryPage() {
	return (
		<PageWrapper>
			<PageTitle
				pageTitle="Inventory & parts"
				pageDescription="Parts in stock, what's running low and what's on order."
				actions={
					<>
						<Button variant="secondary">Import price list</Button>
						<Button variant="primary">
							<Plus />
							Add part
						</Button>
					</>
				}
			/>
		</PageWrapper>
	);
}
