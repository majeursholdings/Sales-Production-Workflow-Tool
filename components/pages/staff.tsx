import PageWrapper from "@/components/layout/pageWrapper";
import StaffPageContent from "@/components/staff/staffPageContent";
import type { StaffMember } from "@/lib/staff";

export default function StaffPage({ staff }: { staff: StaffMember[] }) {
	return (
		<PageWrapper>
			<StaffPageContent initialStaff={staff} />
		</PageWrapper>
	);
}
