import { Card } from "@/components/common/card";

const bar = "animate-pulse rounded-md bg-subtle";

/** Shown while the AI provider and agent rules load: both cards, as placeholder blocks. */
export default function Loading() {
	return (
		<div
			aria-busy="true"
			aria-label="Loading custom design agent settings"
			className="contents"
		>
			<Card className="gap-5">
				<div aria-hidden="true" className="flex flex-col gap-2">
					<div className={`h-6 w-36 ${bar}`} />
					<div className={`h-4 w-full max-w-130 ${bar}`} />
				</div>
				<div aria-hidden="true" className="flex flex-col gap-2">
					{Array.from({ length: 4 }, (_, i) => (
						<div key={i} className={`h-14 ${bar}`} />
					))}
				</div>
				<div aria-hidden="true" className="grid gap-4 md:grid-cols-2">
					<div className={`h-10 ${bar}`} />
					<div className={`h-10 ${bar}`} />
				</div>
				<div aria-hidden="true" className={`h-48 ${bar}`} />
				<div aria-hidden="true" className={`h-28 ${bar}`} />
			</Card>
			<Card className="gap-5">
				<div aria-hidden="true" className={`h-6 w-48 ${bar}`} />
				<div aria-hidden="true" className={`h-8 max-w-130 ${bar}`} />
				<div aria-hidden="true" className="flex flex-col gap-3">
					{Array.from({ length: 3 }, (_, i) => (
						<div key={i} className={`h-6 max-w-100 ${bar}`} />
					))}
				</div>
			</Card>
		</div>
	);
}
