import MachinesPageView from "@/components/pages/machines";
import { getMachinesOverview } from "@/lib/overviews";

export default async function MachinesPage() {
	return <MachinesPageView overview={await getMachinesOverview()} />;
}
