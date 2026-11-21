import { isOwnerRole } from "@/components/layout/navigation";
import ClientsPageView from "@/components/pages/clients";
import { getClients } from "@/lib/data/clients";
import { requireRouteAccess } from "@/lib/session";

export default async function ClientsPage() {
	const user = await requireRouteAccess("/clients");
	const clients = await getClients();
	return <ClientsPageView clients={clients} canDelete={isOwnerRole(user.role)} />;
}
