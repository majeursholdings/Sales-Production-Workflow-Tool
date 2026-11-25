import { costRequestsTitle } from "@/components/costRequests/costRequestsPageContent";
import PartsTableSkeleton from "@/components/costRequests/partsTableSkeleton";
import PageTitle from "@/components/layout/pageTitle";
import PageWrapper from "@/components/layout/pageWrapper";

const pulse = "animate-pulse rounded-md bg-subtle";

/** Shown while cost requests load: the list and the review panel's shapes, with the parts table's real headers. */
export default function Loading() {
	return (
		<PageWrapper>
			<PageTitle {...costRequestsTitle} />
			<div className="flex flex-wrap items-start gap-6">
				<div
					aria-hidden="true"
					className="flex min-w-0 flex-[1_1_320px] flex-col gap-2 rounded-lg border border-line bg-surface p-4"
				>
					<div className={`${pulse} mb-2 h-10 w-36`} />
					{[0, 1, 2].map((i) => (
						<div key={i} className="flex flex-col gap-2 py-2">
							<div className={`${pulse} h-4 w-3/4`} />
							<div className={`${pulse} h-3 w-1/2`} />
						</div>
					))}
				</div>
				<div className="flex min-w-0 flex-[999_1_640px] flex-col gap-5 rounded-lg border border-line bg-surface p-5">
					<div aria-hidden="true" className="flex flex-col gap-2">
						<div className={`${pulse} h-3 w-60`} />
						<div className={`${pulse} h-6 w-80 max-w-full`} />
						<div className={`${pulse} h-3 w-96 max-w-full`} />
					</div>
					<div className="flex flex-wrap items-start gap-6">
						<div
							aria-hidden="true"
							className={`${pulse} aspect-[4/3] max-w-90 flex-[1_1_280px] rounded-lg`}
						/>
						<div className="min-w-0 flex-[999_1_420px]">
							<PartsTableSkeleton />
						</div>
					</div>
				</div>
			</div>
		</PageWrapper>
	);
}
