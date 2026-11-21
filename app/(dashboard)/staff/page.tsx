import StaffPageView from "@/components/pages/staff";
import { getStaff } from "@/lib/data/staff";
import { requireRouteAccess } from "@/lib/session";

export default async function StaffPage() {
	await requireRouteAccess("/staff");
	return <StaffPageView staff={await getStaff()} />;
}
