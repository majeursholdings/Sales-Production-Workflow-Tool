import PageTitle from "@/components/layout/pageTitle";
import PageWrapper from "@/components/layout/pageWrapper";

export default function PurchaseOrdersPage() {
	return (
		<PageWrapper>
			<PageTitle
				pageTitle="Purchase orders"
				pageDescription="Orders placed with suppliers, and their approval and delivery status."
			/>
		</PageWrapper>
	);
}
