import dayjs from "dayjs";
import { notFound } from "next/navigation";
import PageWrapper from "@/components/layout/pageWrapper";
import JobCardDetailView from "@/components/jobCards/jobCardDetailView";
import { getJobCard, sampleJobCardIds } from "@/lib/jobCards";
import { getMachines } from "@/lib/machines";
import { canAccessRoute, hasPermission } from "@/lib/roles";
import { requireRouteAccess } from "@/lib/session";

export function generateStaticParams() {
	return sampleJobCardIds.map((jobCardId) => ({ jobCardId }));
}

export default async function JobCardPage({ params }: PageProps<"/work-orders/[jobCardId]">) {
	const user = await requireRouteAccess("/work-orders");
	const { jobCardId } = await params;
	const card = await getJobCard(jobCardId);
	if (!card) notFound();
	const machines = await getMachines();
	return (
		<PageWrapper>
			<JobCardDetailView
				// a different job card is a fresh page, with its own edits
				key={card.id}
				initialCard={card}
				today={dayjs().format("YYYY-MM-DD")}
				machineNames={machines.filter((m) => m.condition === "working").map((m) => m.name)}
				viewer={{
					name: user.name,
					canEdit: hasPermission(user.roleKey, "work_orders.edit_status"),
					canOpenQuote: canAccessRoute(user.roleKey, "/quotes"),
				}}
			/>
		</PageWrapper>
	);
}
