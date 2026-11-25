import PageTitle from "@/components/layout/pageTitle";
import PageWrapper from "@/components/layout/pageWrapper";

const block = "animate-pulse rounded-lg border border-line bg-surface";

/** Shown while the new purchase order page loads: the title, then the cards' shapes. */
export default function Loading() {
	return (
		<PageWrapper>
			<PageTitle
				pageTitle="New purchase order"
				pageDescription="Draft"
				breadcrumbs={[
					{ label: "Purchase orders", href: "/purchase-orders" },
					{ label: "New purchase order" },
				]}
			/>
			<div
				aria-hidden="true"
				className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)] lg:items-start"
			>
				<div className="flex flex-col gap-6">
					<div className={`${block} h-64`} />
					<div className={`${block} h-56`} />
					<div className={`${block} h-72`} />
				</div>
				<div className="flex flex-col gap-6">
					<div className={`${block} h-48`} />
					<div className={`${block} h-60`} />
				</div>
			</div>
		</PageWrapper>
	);
}
