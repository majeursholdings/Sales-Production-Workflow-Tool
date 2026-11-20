import { isOwnerRole } from "@/components/layout/navigation";
import ClientsPageView from "@/components/pages/clients";
import { getClients } from "@/lib/clients";
import { getCurrentUser } from "@/lib/session";

export default async function ClientsPage() {
	const [clients, user] = await Promise.all([getClients(), getCurrentUser()]);
	return <ClientsPageView clients={clients} canDelete={isOwnerRole(user.role)} />;
}
