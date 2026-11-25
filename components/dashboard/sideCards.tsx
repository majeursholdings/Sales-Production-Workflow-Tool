import { Badge } from "@/components/common/badge";
import { Avatar, Card } from "@/components/common/card";
import { formatNaira } from "@/lib/currency";
import type { BadgeVariant } from "@/components/common/badge";
import type { DeliveryItem, FeedItem, PipelineRow } from "@/lib/dashboard";

const barColour: Record<BadgeVariant, string> = {
	neutral: "bg-fg-tertiary",
	info: "bg-info-fg",
	success: "bg-success-fg",
	warning: "bg-warning-fg",
	danger: "bg-danger-fg",
};

/** "Deliveries expected": supplier orders on their way, soonest first. */
export function DeliveriesCard({ items }: { items: DeliveryItem[] }) {
	return (
		<Card>
			<h2>Deliveries expected</h2>
			{items.length === 0 && (
				<p className="text-body text-fg-secondary">No supplier deliveries on the way.</p>
			)}
			<ul className="flex flex-col">
				{items.map((d) => (
					<li
						key={d.detail}
						className="flex items-start gap-3 border-t border-line py-3 first:border-t-0 first:pt-0"
					>
						<Badge variant={d.tone}>{d.date}</Badge>
						<span className="flex min-w-0 flex-1 flex-col">
							<strong className="text-fg">{d.client}</strong>
							<span className="text-small text-fg-tertiary">{d.detail}</span>
						</span>
					</li>
				))}
			</ul>
			<p className="text-small text-fg-tertiary">Overdue deliveries are shown in red.</p>
		</Card>
	);
}

/** "Quotes by status": value of the last 30 days' quotes, each as a bar against the largest. */
export function QuotesByStatusCard({ rows }: { rows: PipelineRow[] }) {
	const max = Math.max(...rows.map((r) => r.amount), 1);
	return (
		<Card>
			<h2>Quotes by status</h2>
			{rows.length === 0 && (
				<p className="text-body text-fg-secondary">No quotes in the last 30 days.</p>
			)}
			{rows.map((r) => (
				<div key={r.label} className="flex flex-col gap-1">
					<div className="flex items-baseline justify-between gap-3">
						<span className="text-body text-fg-secondary">{r.label}</span>
						<span className="font-bold text-fg tabular">{formatNaira(r.amount)}</span>
					</div>
					<div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-subtle">
						<div
							className={`h-full rounded-full ${barColour[r.tone]}`}
							style={{ width: `${Math.max(4, Math.round((r.amount / max) * 100))}%` }}
						/>
					</div>
				</div>
			))}
			<p className="text-small text-fg-tertiary">
				Value of quotes from the last 30 days, by current status.
			</p>
		</Card>
	);
}

/** "Recent activity": the latest things teammates did. */
export function RecentActivityCard({ items }: { items: FeedItem[] }) {
	return (
		<Card>
			<h2>Recent activity</h2>
			{items.length === 0 && <p className="text-body text-fg-secondary">No activity yet.</p>}
			<ul className="flex flex-col">
				{items.map((f) => (
					<li
						key={`${f.who}-${f.when}-${f.text}`}
						className="flex items-start gap-3 border-t border-line py-3 first:border-t-0 first:pt-0 last:pb-0"
					>
						<Avatar initials={f.who} />
						<span className="flex min-w-0 flex-1 flex-col">
							<span className="text-body text-fg">{f.text}</span>
							<span className="text-small text-fg-tertiary">{f.when}</span>
						</span>
					</li>
				))}
			</ul>
		</Card>
	);
}
