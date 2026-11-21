import PageWrapper from "@/components/layout/pageWrapper";

const block = "animate-pulse rounded-md bg-subtle";

/** Shown while an invoice loads: the same two-column shape, as placeholders. */
export default function Loading() {
	return (
		<PageWrapper aria-busy="true" aria-label="Loading invoice">
			<div className="space-y-2">
				<div className={`${block} h-4 w-48`} />
				<div className={`${block} h-8 w-64`} />
				<div className={`${block} h-4 w-96 max-w-full`} />
			</div>
			<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
				<div className="flex flex-col gap-6 rounded-lg border border-line bg-surface p-6 md:p-10">
					<div className={`${block} h-10 w-44`} />
					<div className={`${block} h-16`} />
					{[0, 1].map((i) => (
						<div key={i} className={`${block} h-12`} />
					))}
					<div className={`${block} ms-auto h-24 w-80 max-w-full`} />
				</div>
				<div className="flex flex-col gap-6">
					<div className={`${block} h-48`} />
					<div className={`${block} h-64`} />
				</div>
			</div>
		</PageWrapper>
	);
}
