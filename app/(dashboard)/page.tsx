import DashboardPage from "@/components/pages/dashboard";
import { getDashboardOverview } from "@/lib/dashboard";
import { getCurrentUser } from "@/lib/session";

export default async function HomePage() {
	const user = await getCurrentUser();
	const overview = await getDashboardOverview(user.role);
	return (
		<DashboardPage greeting={`Welcome back, ${user.name.split(" ")[0]}`} overview={overview} />
	);
}
