import PageTitle from "@/components/layout/pageTitle";
import PageWrapper from "@/components/layout/pageWrapper";

export default function InventoryPage() {
	return (
		<PageWrapper>
			<PageTitle
				pageTitle="Inventory & parts"
				pageDescription="Parts in stock, what's running low and what's on order."
			/>
		</PageWrapper>
	);
}
