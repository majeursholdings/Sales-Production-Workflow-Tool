import dayjs from "dayjs";
import MachinesPageView from "@/components/pages/machines";
import { getMachines } from "@/lib/machines";
import { requireRouteAccess } from "@/lib/session";

export default async function MachinesPage() {
	const user = await requireRouteAccess("/machines");
	return (
		<MachinesPageView
			machines={await getMachines()}
			today={dayjs().format("YYYY-MM-DD")}
			// Production sees what a machine does, not what it costs
			seesCost={user.roleKey !== "production"}
		/>
	);
}
