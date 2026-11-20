import PageWrapper from "@/components/layout/pageWrapper";

const block = "animate-pulse rounded-md bg-subtle";

/** Shown while a quote loads: the same two-column shape, as placeholders. */
export default function Loading() {
	return (
		<PageWrapper aria-busy="true" aria-label="Loading quote">
			<div className="space-y-2">
				<div className={`${block} h-4 w-48`} />
				<div className={`${block} h-8 w-64`} />
				<div className={`${block} h-4 w-96 max-w-full`} />
			</div>
			<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
				<div className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5">
					<div className={`${block} h-6 w-24`} />
					{[0, 1, 2].map((i) => (
						<div key={i} className={`${block} h-12`} />
					))}
				</div>
				<div className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5">
					<div className={`${block} h-6 w-32`} />
					<div className={`${block} h-16`} />
				</div>
			</div>
		</PageWrapper>
	);
}
