import PageWrapper from "@/components/layout/pageWrapper";
import { TableSkeletonRows } from "@/components/tables/tableSkeletonRows";

const block = "animate-pulse rounded-md bg-subtle";

/** Shown while the dashboard fetches its data: the same grid of cards, as placeholders. */
export default function Loading() {
	return (
		<PageWrapper aria-busy="true" aria-label="Loading dashboard">
			<div className="space-y-2">
				<div className={`${block} h-8 w-64`} />
				<div className={`${block} h-4 w-80 max-w-full`} />
			</div>
			<div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] overflow-hidden rounded-lg border border-line bg-surface max-md:grid-cols-2">
				{[0, 1, 2, 3].map((i) => (
					<div
						key={i}
						className="flex flex-col gap-2 px-5 py-4 shadow-[-1px_0_0_var(--border-default),0_-1px_0_var(--border-default)]"
					>
						<div className={`${block} h-4 w-28`} />
						<div className={`${block} h-7 w-36`} />
						<div className={`${block} h-4 w-32`} />
					</div>
				))}
			</div>
			<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
				<div className="flex min-w-0 flex-col gap-6">
					<div className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5">
						<div className={`${block} h-6 w-48`} />
						{[0, 1, 2].map((i) => (
							<div key={i} className={`${block} h-10`} />
						))}
					</div>
					<div className="overflow-hidden rounded-lg border border-line bg-surface">
						<table className="w-full text-body">
							<tbody>
								<TableSkeletonRows cols={4} rows={3} />
							</tbody>
						</table>
					</div>
				</div>
				<div className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5">
					<div className={`${block} h-6 w-40`} />
					{[0, 1, 2, 3].map((i) => (
						<div key={i} className={`${block} h-8`} />
					))}
				</div>
			</div>
		</PageWrapper>
	);
}
