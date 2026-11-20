import StaffPageView from "@/components/pages/staff";
import { getStaffOverview } from "@/lib/overviews";

export default async function StaffPage() {
	return <StaffPageView overview={await getStaffOverview()} />;
}
