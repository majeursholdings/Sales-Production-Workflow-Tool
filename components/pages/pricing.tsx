import PageTitle from "@/components/layout/pageTitle";
import PageWrapper from "@/components/layout/pageWrapper";
import { Button } from "@/components/common/buttons";

export default function PricingPage() {
	return (
		<PageWrapper>
			<PageTitle
				pageTitle="Pricing & margins"
				pageDescription="Markups and margins applied when a quote is priced."
				actions={
					<>
						<Button disabled>Discard changes</Button>
						<Button variant="primary" disabled>
							Save changes
						</Button>
					</>
				}
			/>
		</PageWrapper>
	);
}
