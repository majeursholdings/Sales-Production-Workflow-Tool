import MachinesPageView from "@/components/pages/machines";
import { getMachinesOverview } from "@/lib/overviews";
import { requireRouteAccess } from "@/lib/session";

export default async function MachinesPage() {
	await requireRouteAccess("/machines");
	return <MachinesPageView overview={await getMachinesOverview()} />;
}
