import StaffPageView from "@/components/pages/staff";
import { requireRouteAccess } from "@/lib/session";
import { getStaff } from "@/lib/staff";

export default async function StaffPage() {
	await requireRouteAccess("/staff");
	return <StaffPageView staff={await getStaff()} />;
}
