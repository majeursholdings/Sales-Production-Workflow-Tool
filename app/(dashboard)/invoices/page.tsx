import InvoicesPageView from "@/components/pages/invoices";
import { getInvoicesOverview } from "@/lib/overviews";

export default async function InvoicesPage() {
	return <InvoicesPageView overview={await getInvoicesOverview()} />;
}
