import DashboardPage from "@/components/pages/dashboard";
import { getDashboard } from "@/lib/dashboard";
import { getCurrentUser } from "@/lib/session";

export default async function HomePage() {
	const user = await getCurrentUser();
	const data = await getDashboard(user.role);
	return <DashboardPage greeting={`Welcome back, ${user.name.split(" ")[0]}`} data={data} />;
}
