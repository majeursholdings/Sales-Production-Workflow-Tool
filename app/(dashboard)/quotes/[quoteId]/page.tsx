import { notFound } from "next/navigation";
import { isOwnerRole } from "@/components/layout/navigation";
import QuoteDetailView from "@/components/quotes/quoteDetailView";
import { getQuoteDetail, sampleQuoteIds } from "@/lib/quotes";
import { getCurrentUser } from "@/lib/session";

export function generateStaticParams() {
	return sampleQuoteIds.map((quoteId) => ({ quoteId }));
}

export default async function QuotePage({ params }: PageProps<"/quotes/[quoteId]">) {
	const { quoteId } = await params;
	const [detail, user] = await Promise.all([getQuoteDetail(quoteId), getCurrentUser()]);
	if (!detail) notFound();
	// MD, GM and Accounting record deposits
	const canRecordDeposit = isOwnerRole(user.role) || /accounting/i.test(user.role);
	return <QuoteDetailView detail={detail} canRecordDeposit={canRecordDeposit} />;
}
