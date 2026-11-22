import dayjs from "dayjs";
import PageWrapper from "@/components/layout/pageWrapper";
import JobCardsPageContent from "@/components/jobCards/jobCardsPageContent";
import { getJobCards } from "@/lib/jobCards";
import { requireRouteAccess } from "@/lib/session";

export default async function WorkOrdersPage() {
	await requireRouteAccess("/work-orders");
	return (
		<PageWrapper>
			<JobCardsPageContent cards={await getJobCards()} today={dayjs().format("YYYY-MM-DD")} />
		</PageWrapper>
	);
}
