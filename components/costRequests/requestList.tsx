"use client";

import { Badge } from "@/components/common/badge";
import { Card, CardHeader } from "@/components/common/card";
import { OptionsMenu } from "@/components/tables";
import { cn } from "@/lib/cn";
import {
	REQUEST_STATUS,
	ageLabel,
	statusOf,
	type CostRequest,
	type Review,
} from "@/lib/costRequests";

export type ListFilter = "" | "open" | "done";

/** The requests down the left: pick one to review it. */
export default function RequestList({
	requests,
	reviews,
	selected,
	filter,
	now,
	onFilter,
	onSelect,
}: {
	requests: CostRequest[];
	reviews: Record<string, Review>;
	selected: string | null;
	filter: ListFilter;
	now: string;
	onFilter: (filter: ListFilter) => void;
	onSelect: (id: string) => void;
}) {
	const openCount = requests.filter((r) => r.status === "open").length;
	const shown = requests.filter((r) =>
		filter === "open" ? r.status === "open" : filter === "done" ? r.status !== "open" : true,
	);

	return (
		<Card flush aria-label="Cost requests" className="min-w-0 flex-[1_1_320px] self-start">
			<CardHeader>
				<OptionsMenu
					label="Show"
					items={[
						{ label: `Open (${openCount})`, value: "open" },
						{ label: `Closed (${requests.length - openCount})`, value: "done" },
					]}
					value={filter}
					onChange={(v) => onFilter(v as ListFilter)}
					resetLabel={`All (${requests.length})`}
				/>
			</CardHeader>
			<div className="flex flex-col gap-1 p-2">
				{shown.length === 0 && (
					<p className="px-3 py-6 text-center text-body text-fg-secondary">
						{filter === "open" ? "No open requests. Nice work." : "Nothing here yet."}
					</p>
				)}
				{shown.map((r) => {
					const status = statusOf(r);
					const flagged = reviews[r.id]?.flagged ?? 0;
					const age = ageLabel(r.requestedAt, now);
					return (
						<button
							key={r.id}
							type="button"
							aria-pressed={r.id === selected}
							onClick={() => onSelect(r.id)}
							className={cn(
								"flex cursor-pointer flex-col gap-0.5 rounded-md border border-transparent px-3 py-2.5 text-start hover:bg-subtle",
								"focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
								"aria-pressed:border-accent aria-pressed:bg-accent-subtle",
							)}
						>
							<span className="flex items-start gap-2">
								<strong className="flex-1 text-fg">{r.title}</strong>
								<Badge variant={REQUEST_STATUS[status].tone}>
									{REQUEST_STATUS[status].label}
								</Badge>
							</span>
							<span className="text-small text-fg-secondary">
								{r.id} · {r.client} · {r.requestedBy}
							</span>
							<span className="text-small text-fg-tertiary">
								{r.status === "approved"
									? `Approved · ${age}`
									: r.status === "declined"
										? `Closed · ${age}`
										: `${flagged} part${flagged === 1 ? "" : "s"} flagged · ${age}`}
							</span>
						</button>
					);
				})}
			</div>
		</Card>
	);
}
