import type { Metadata } from "next";
import FinancePageView from "@/components/pages/finance";
import { getFinanceData } from "@/lib/data/finance";
import { requireRouteAccess } from "@/lib/session";

export const metadata: Metadata = { title: "Revenue & expenses" };

export default async function FinancePage() {
	const user = await requireRouteAccess("/finance");
	return <FinancePageView data={await getFinanceData()} recordedBy={user.name} />;
}
