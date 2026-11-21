import type { Metadata } from "next";
import ReviewStep from "@/components/quotes/builder/reviewStep";
import { requirePermission } from "@/lib/session";

export const metadata: Metadata = { title: "New quote: review and send" };

export default async function NewQuoteReviewPage() {
	const user = await requirePermission("quotes.create");
	return <ReviewStep createdBy={user.name} />;
}
