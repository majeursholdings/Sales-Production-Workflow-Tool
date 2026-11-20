import PageTitle from "@/components/layout/pageTitle";
import PageWrapper from "@/components/layout/pageWrapper";
import { Button } from "@/components/common/buttons";
import { Plus } from "lucide-react";

export default function PurchaseOrdersPage() {
	return (
		<PageWrapper>
			<PageTitle
				pageTitle="Purchase orders"
				pageDescription="Orders placed with suppliers, and their approval and delivery status."
				actions={
					<>
						<Button variant="primary">
							<Plus />
							New purchase order
						</Button>
					</>
				}
			/>
		</PageWrapper>
	);
}
