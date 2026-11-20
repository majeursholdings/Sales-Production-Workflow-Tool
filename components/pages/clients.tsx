import ClientsPageContent from "@/components/clients/clientsPageContent";
import PageWrapper from "@/components/layout/pageWrapper";
import type { Client } from "@/lib/clients";

export default function ClientsPage({
	clients,
	canDelete,
}: {
	clients: Client[];
	canDelete: boolean;
}) {
	return (
		<PageWrapper>
			<ClientsPageContent initialClients={clients} canDelete={canDelete} />
		</PageWrapper>
	);
}
