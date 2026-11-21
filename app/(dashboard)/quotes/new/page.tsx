import type { Metadata } from "next";
import ClientStep from "@/components/quotes/builder/clientStep";
import { getClients } from "@/lib/data/clients";
import { requirePermission } from "@/lib/session";

export const metadata: Metadata = { title: "New quote: client" };

export default async function NewQuotePage() {
	const user = await requirePermission("quotes.create");
	const clients = await getClients();
	return <ClientStep clients={clients} createdBy={user.name} />;
}
