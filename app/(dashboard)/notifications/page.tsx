import NotificationsPageView from "@/components/pages/notifications";
import { getCurrentUser } from "@/lib/session";

export default async function NotificationsPage() {
	await getCurrentUser();
	return <NotificationsPageView />;
}
