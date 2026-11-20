import PageTitle from "@/components/layout/pageTitle";
import PageWrapper from "@/components/layout/pageWrapper";
import { Button } from "@/components/common/buttons";
import { Plus } from "lucide-react";

export default function SuppliersPage() {
	return (
		<PageWrapper>
			<PageTitle
				pageTitle="Suppliers"
				pageDescription="Who you buy from, their prices and how they've performed."
				actions={
					<>
						<Button variant="primary">
							<Plus />
							Add supplier
						</Button>
					</>
				}
			/>
		</PageWrapper>
	);
}
