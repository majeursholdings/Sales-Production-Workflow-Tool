import { furnitureTypesTitle } from "@/components/furniture/furnitureTypesTitle";
import PageTitle from "@/components/layout/pageTitle";
import PageWrapper from "@/components/layout/pageWrapper";

const block = "animate-pulse rounded-md bg-subtle";

/** Shown while furniture types load: the real title, a list and a template as placeholders. */
export default function Loading() {
	return (
		<PageWrapper aria-busy="true" aria-label="Loading furniture types">
			<PageTitle {...furnitureTypesTitle} />
			<div className="flex flex-wrap items-start gap-6">
				<div className="flex min-w-0 flex-1 basis-72 flex-col gap-3 rounded-lg border border-line bg-surface p-5 lg:max-w-sm">
					<div className={`${block} h-10`} />
					{[0, 1, 2, 3, 4, 5].map((i) => (
						<div key={i} className={`${block} h-10`} />
					))}
				</div>
				<div className="flex min-w-0 flex-1 basis-140 flex-col gap-4">
					<div className={`${block} h-48`} />
					<div className={`${block} h-72`} />
					<div className={`${block} h-48`} />
				</div>
			</div>
		</PageWrapper>
	);
}
