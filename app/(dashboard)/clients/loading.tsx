import ClientsTableSkeleton from "@/components/clients/clientsTableSkeleton";
import PageTitle from "@/components/layout/pageTitle";
import PageWrapper from "@/components/layout/pageWrapper";
import { clientsTitle } from "@/components/clients/clientsPageContent";

/** Shown while the clients page fetches its data. */
export default function Loading() {
	return (
		<PageWrapper>
			<PageTitle {...clientsTitle} />
			<ClientsTableSkeleton />
		</PageWrapper>
	);
}
