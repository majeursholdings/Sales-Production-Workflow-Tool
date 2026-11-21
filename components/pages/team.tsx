import PageWrapper from "@/components/layout/pageWrapper";
import TeamPageContent from "@/components/team/teamPageContent";
import type { TeamMember } from "@/lib/team";

export default function TeamPageView({
	members,
	currentUserId,
	canCreateUsers,
}: {
	members: TeamMember[];
	currentUserId: string;
	canCreateUsers: boolean;
}) {
	return (
		<PageWrapper>
			<TeamPageContent
				initialMembers={members}
				currentUserId={currentUserId}
				canCreateUsers={canCreateUsers}
			/>
		</PageWrapper>
	);
}
