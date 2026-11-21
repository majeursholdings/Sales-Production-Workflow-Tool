import InvoicesPageView from "@/components/pages/invoices";
import { getInvoicesOverview } from "@/lib/overviews";
import { requireRouteAccess } from "@/lib/session";

export default async function InvoicesPage() {
	await requireRouteAccess("/invoices");
	return <InvoicesPageView overview={await getInvoicesOverview()} />;
}
