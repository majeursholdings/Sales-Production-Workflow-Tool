import type { Metadata } from "next";
import ClientStep from "@/components/quotes/builder/clientStep";
import { getClients } from "@/lib/clients";
import { requirePermission } from "@/lib/session";

export const metadata: Metadata = { title: "New quote: client" };

export default async function NewQuotePage() {
	const [clients, user] = await Promise.all([getClients(), requirePermission("quotes.create")]);
	return <ClientStep clients={clients} createdBy={user.name} />;
}
