import EntriesTableSkeleton from "@/components/finance/entriesTableSkeleton";
import { financeTitle } from "@/components/finance/financeTitle";
import PageTitle from "@/components/layout/pageTitle";
import PageWrapper from "@/components/layout/pageWrapper";

const block = "animate-pulse rounded-md bg-subtle";

/** Shown while Revenue & expenses loads: the real title, placeholder figures and chart, the table's real headers. */
export default function Loading() {
	return (
		<PageWrapper aria-busy="true" aria-label="Loading revenue and expenses">
			<PageTitle {...financeTitle} />
			<div aria-hidden="true" className={`${block} h-10 w-72 max-w-full`} />
			<div
				aria-hidden="true"
				className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] overflow-hidden rounded-lg border border-line bg-surface max-md:grid-cols-2"
			>
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
					<div aria-hidden="true" className={`${block} h-80`} />
					<EntriesTableSkeleton />
				</div>
				<div aria-hidden="true" className={`${block} h-96`} />
			</div>
		</PageWrapper>
	);
}
