import type { Metadata } from "next";
import ItemsStep from "@/components/quotes/builder/itemsStep";
import { getQuoteBuilderSetup } from "@/lib/data/quoteBuilder";
import { requirePermission } from "@/lib/session";

export const metadata: Metadata = { title: "New quote: items and parts" };

export default async function NewQuoteItemsPage() {
	const user = await requirePermission("quotes.create");
	return <ItemsStep createdBy={user.name} setup={await getQuoteBuilderSetup()} />;
}
