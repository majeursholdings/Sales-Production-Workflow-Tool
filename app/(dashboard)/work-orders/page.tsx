import dayjs from "dayjs";
import PageWrapper from "@/components/layout/pageWrapper";
import JobCardsPageContent from "@/components/jobCards/jobCardsPageContent";
import { getJobCards, getPartOptions, getQuotesWithoutJobCard } from "@/lib/data/jobCards";
import { hasPermission } from "@/lib/roles";
import { requireRouteAccess } from "@/lib/session";

export default async function WorkOrdersPage() {
	const user = await requireRouteAccess("/work-orders");
	const canCreate = hasPermission(user.roleKey, "work_orders.edit_status");
	const [cards, quotes, parts] = await Promise.all([
		getJobCards(),
		canCreate ? getQuotesWithoutJobCard() : [],
		canCreate ? getPartOptions() : [],
	]);
	return (
		<PageWrapper>
			<JobCardsPageContent
				cards={cards}
				today={dayjs().format("YYYY-MM-DD")}
				create={canCreate ? { quotes, parts } : undefined}
			/>
		</PageWrapper>
	);
}
