import PageTitle from "@/components/layout/pageTitle";
import PageWrapper from "@/components/layout/pageWrapper";
import { Button } from "@/components/common/buttons";
import { Plus } from "lucide-react";

export default function CostRatesPage() {
	return (
		<PageWrapper>
			<PageTitle
				pageTitle="Cost rates"
				pageDescription="The labour, machine and overhead rates used to cost every quote."
				actions={
					<>
						<Button variant="primary">
							<Plus />
							Add team member
						</Button>
					</>
				}
			/>
		</PageWrapper>
	);
}
