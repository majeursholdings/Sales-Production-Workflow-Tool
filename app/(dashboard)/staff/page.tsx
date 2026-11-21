import StaffPageView from "@/components/pages/staff";
import { getStaff } from "@/lib/staff";

export default async function StaffPage() {
	return <StaffPageView staff={await getStaff()} />;
}
