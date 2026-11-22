import PageWrapper from "@/components/layout/pageWrapper";

const block = "animate-pulse rounded-md bg-subtle";

/** Shown while the new furniture type form loads. */
export default function Loading() {
	return (
		<PageWrapper aria-busy="true" aria-label="Loading new furniture type">
			<div className="space-y-2">
				<div className={`${block} h-4 w-56`} />
				<div className={`${block} h-8 w-64`} />
				<div className={`${block} h-4 w-96 max-w-full`} />
			</div>
			<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
				<div className="flex flex-col gap-6">
					<div className={`${block} h-96`} />
					<div className={`${block} h-48`} />
				</div>
				<div className={`${block} h-64`} />
			</div>
		</PageWrapper>
	);
}
