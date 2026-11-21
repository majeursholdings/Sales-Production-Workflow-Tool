import type { Metadata } from "next";
import InvoicesPageView from "@/components/pages/invoices";
import { getInvoices, toInvoiceRow } from "@/lib/invoices";
import { getInvoicesOverview } from "@/lib/overviews";
import { requireRouteAccess } from "@/lib/session";

export const metadata: Metadata = { title: "Invoices" };

export default async function InvoicesPage() {
	await requireRouteAccess("/invoices");
	const [overview, invoices] = await Promise.all([getInvoicesOverview(), getInvoices()]);
	return <InvoicesPageView overview={overview} invoices={invoices.map(toInvoiceRow)} />;
}
