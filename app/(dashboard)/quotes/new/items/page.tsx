import type { Metadata } from "next";
import ItemsStep from "@/components/quotes/builder/itemsStep";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = { title: "New quote: items and parts" };

export default async function NewQuoteItemsPage() {
	const user = await getCurrentUser();
	return <ItemsStep createdBy={user.name} />;
}
