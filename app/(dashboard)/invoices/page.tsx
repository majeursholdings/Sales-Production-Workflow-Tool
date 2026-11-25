import type { Metadata } from "next";
import InvoicesPageView from "@/components/pages/invoices";
import { getInvoices } from "@/lib/data/invoices";
import { buildInvoicesOverview, toInvoiceRow } from "@/lib/invoices";
import { requireRouteAccess } from "@/lib/session";

export const metadata: Metadata = { title: "Invoices" };

export default async function InvoicesPage() {
	await requireRouteAccess("/invoices");
	const invoices = await getInvoices();
	return (
		<InvoicesPageView
			overview={buildInvoicesOverview(invoices)}
			invoices={invoices.map(toInvoiceRow)}
		/>
	);
}
