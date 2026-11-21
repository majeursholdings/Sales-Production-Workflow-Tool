import PageTitle from "@/components/layout/pageTitle";
import PageWrapper from "@/components/layout/pageWrapper";
import { teamTitle } from "@/components/team/teamTitle";
import TeamTableSkeleton from "@/components/team/teamTableSkeleton";

/** Shown while the team page fetches its data. */
export default function Loading() {
	return (
		<PageWrapper>
			<PageTitle {...teamTitle} />
			<TeamTableSkeleton />
		</PageWrapper>
	);
}
