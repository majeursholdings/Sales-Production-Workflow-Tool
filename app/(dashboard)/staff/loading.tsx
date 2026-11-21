import PageTitle from "@/components/layout/pageTitle";
import PageWrapper from "@/components/layout/pageWrapper";
import StaffTableSkeleton from "@/components/staff/staffTableSkeleton";
import { staffTitle } from "@/components/staff/staffPageContent";

/** Shown while the staff page fetches its data. */
export default function Loading() {
	return (
		<PageWrapper>
			<PageTitle {...staffTitle} />
			<div aria-hidden="true" className="h-24 animate-pulse rounded-lg bg-subtle" />
			<StaffTableSkeleton />
		</PageWrapper>
	);
}
