import { isOwnerRole } from "@/components/layout/navigation";
import ClientsPageView from "@/components/pages/clients";
import { getClients } from "@/lib/clients";
import { requireRouteAccess } from "@/lib/session";

export default async function ClientsPage() {
	const [clients, user] = await Promise.all([getClients(), requireRouteAccess("/clients")]);
	return <ClientsPageView clients={clients} canDelete={isOwnerRole(user.role)} />;
}
