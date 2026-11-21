import { Card } from "@/components/common/card";

/** Shown while a settings section loads: a card of placeholder lines. */
export default function Loading() {
	return (
		<Card aria-busy="true" aria-label="Loading settings" className="gap-5">
			<div aria-hidden="true" className="h-6 w-40 animate-pulse rounded-sm bg-subtle" />
			<div aria-hidden="true" className="grid gap-4 sm:grid-cols-2">
				<div className="h-10 animate-pulse rounded-md bg-subtle" />
				<div className="h-10 animate-pulse rounded-md bg-subtle" />
				<div className="h-10 animate-pulse rounded-md bg-subtle" />
				<div className="h-10 animate-pulse rounded-md bg-subtle" />
			</div>
			<div aria-hidden="true" className="h-24 animate-pulse rounded-md bg-subtle" />
		</Card>
	);
}
