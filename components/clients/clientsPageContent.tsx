"use client";

import { Suspense, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/common/buttons";
import PageTitle from "@/components/layout/pageTitle";
import type { Client } from "@/lib/clients";
import { createClientAction, deleteClientAction } from "@/app/(dashboard)/clients/actions";
import AddClientDrawer from "./addClientDrawer";
import ClientsTable from "./clientsTable";
import ClientsTableSkeleton from "./clientsTableSkeleton";

export const clientsTitle = {
	pageTitle: "Clients",
	pageDescription:
		"Everyone Majeurs quotes for. Add someone here before their first quote, or they're added when a quote is sent.",
};

/**
 * The page title (with its "Add new client" button) and the table share the
 * client list, so both live here.
 */
export default function ClientsPageContent({
	initialClients,
	canDelete,
}: {
	initialClients: Client[];
	canDelete: boolean;
}) {
	const [clients, setClients] = useState(initialClients);
	const [adding, setAdding] = useState(false);

	return (
		<>
			<PageTitle
				{...clientsTitle}
				actions={
					<Button variant="primary" onClick={() => setAdding(true)}>
						<Plus />
						Add new client
					</Button>
				}
			/>
			{/* the table keeps its search, filters and page in the URL, which needs Suspense on a static page */}
			<Suspense fallback={<ClientsTableSkeleton />}>
				<ClientsTable
					clients={clients}
					canDelete={canDelete}
					onDelete={async (client) => {
						const result = await deleteClientAction(client.id);
						if (!result.ok) {
							toast.error(result.message);
							return;
						}
						setClients((list) => list.filter((c) => c.id !== client.id));
						toast.success(`${client.name} deleted.`);
					}}
				/>
			</Suspense>
			{adding && (
				<AddClientDrawer
					clients={clients}
					onClose={() => setAdding(false)}
					onAdd={async (draft) => {
						const phone = draft.contact.split(" · ")[0] ?? "";
						const result = await createClientAction({
							name: draft.name,
							phone: phone === draft.email ? "" : phone,
							email: draft.email,
							type: draft.type,
							company: draft.company,
							location: draft.location,
							source: draft.source,
						});
						if (!result.ok) {
							toast.error(result.message);
							return;
						}
						setClients((list) => [result.data, ...list]);
						setAdding(false);
						toast.success(`${result.data.name} added to clients.`);
					}}
				/>
			)}
		</>
	);
}
