import PageWrapper from "@/components/layout/pageWrapper";

/** Shown while a job card's page fetches its data. */
export default function JobCardDetailSkeleton() {
	return (
		<PageWrapper>
			<div aria-hidden="true" className="flex flex-col gap-3">
				<div className="h-4 w-40 animate-pulse rounded-sm bg-subtle" />
				<div className="h-8 w-64 animate-pulse rounded-md bg-subtle" />
			</div>
			<div aria-hidden="true" className="h-24 animate-pulse rounded-lg bg-subtle" />
			<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)] lg:items-start">
				<div aria-hidden="true" className="h-96 animate-pulse rounded-lg bg-subtle" />
				<div aria-hidden="true" className="h-64 animate-pulse rounded-lg bg-subtle" />
			</div>
		</PageWrapper>
	);
}
