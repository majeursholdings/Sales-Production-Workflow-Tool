import DashboardPage from "@/components/pages/dashboard";
import { getCurrentUser } from "@/lib/session";

export default async function HomePage() {
	const user = await getCurrentUser();
	return <DashboardPage greeting={`Welcome back, ${user.name.split(" ")[0]}`} />;
}
