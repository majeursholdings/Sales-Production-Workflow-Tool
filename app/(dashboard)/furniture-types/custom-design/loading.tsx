import { Card } from "@/components/common/card";
import PageTitle from "@/components/layout/pageTitle";
import PageWrapper from "@/components/layout/pageWrapper";

const bar = "animate-pulse rounded-md bg-subtle";

/** Shown while the custom design page loads: its title, then the upload form as placeholders. */
export default function Loading() {
	return (
		<PageWrapper>
			<PageTitle
				breadcrumbs={[
					{ label: "Furniture types", href: "/furniture-types" },
					{ label: "Custom design from photo" },
				]}
				pageTitle="Custom design from photo"
				pageDescription="Start a one-off piece from a client's photo or sketch. The parts agent picks parts from inventory and flags anything we don't stock."
			/>
			<Card flush aria-busy="true" aria-label="Loading the upload form">
				<div
					aria-hidden="true"
					className="flex flex-col gap-2 border-b border-line px-5 py-4"
				>
					<div className={`h-6 w-56 ${bar}`} />
					<div className={`h-4 w-full max-w-120 ${bar}`} />
				</div>
				<div aria-hidden="true" className="flex max-w-160 flex-col gap-5 px-5 py-5">
					<div className="grid gap-2 sm:grid-cols-2">
						<div className={`h-16 ${bar}`} />
						<div className={`h-16 ${bar}`} />
					</div>
					<div className={`h-36 ${bar}`} />
					<div className={`h-28 ${bar}`} />
					<div className="flex flex-wrap gap-6">
						<div className={`h-36 flex-[1_1_200px] ${bar}`} />
						<div className="flex flex-[1_1_220px] flex-col gap-3">
							<div className={`h-10 ${bar}`} />
							<div className={`h-10 ${bar}`} />
							<div className={`h-10 ${bar}`} />
						</div>
					</div>
				</div>
			</Card>
		</PageWrapper>
	);
}
