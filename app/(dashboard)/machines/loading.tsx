import MachinesTableSkeleton from "@/components/machines/machinesTableSkeleton";
import { machinesTitle } from "@/components/machines/machinesPageContent";
import PageTitle from "@/components/layout/pageTitle";
import PageWrapper from "@/components/layout/pageWrapper";

/** Shown while the machines page fetches its data. */
export default function Loading() {
	return (
		<PageWrapper>
			<PageTitle {...machinesTitle} />
			<div aria-hidden="true" className="h-24 animate-pulse rounded-lg bg-subtle" />
			<MachinesTableSkeleton />
		</PageWrapper>
	);
}
