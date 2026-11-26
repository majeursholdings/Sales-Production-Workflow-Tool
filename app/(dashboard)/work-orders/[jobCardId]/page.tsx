import dayjs from "dayjs";
import { notFound } from "next/navigation";
import PageWrapper from "@/components/layout/pageWrapper";
import JobCardDetailView from "@/components/jobCards/jobCardDetailView";
import { getJobCard, getWorkshopPeople } from "@/lib/data/jobCards";
import { getWorkingMachines } from "@/lib/data/machines";
import { canAccessRoute, hasPermission } from "@/lib/roles";
import { requireRouteAccess } from "@/lib/session";

export default async function JobCardPage({ params }: PageProps<"/work-orders/[jobCardId]">) {
	const user = await requireRouteAccess("/work-orders");
	const { jobCardId } = await params;
	const card = await getJobCard(decodeURIComponent(jobCardId));
	if (!card) notFound();
	const canEdit = hasPermission(user.roleKey, "work_orders.edit_status");
	const [machines, people] = canEdit
		? await Promise.all([getWorkingMachines(), getWorkshopPeople()])
		: [[], []];
	return (
		<PageWrapper>
			<JobCardDetailView
				// a different job card is a fresh page, with its own drawers closed
				key={card.id}
				card={card}
				today={dayjs().format("YYYY-MM-DD")}
				machines={machines}
				people={people}
				viewer={{
					name: user.name,
					canEdit,
					canOpenQuote: !!card.quote && canAccessRoute(user.roleKey, "/quotes"),
				}}
			/>
		</PageWrapper>
	);
}
