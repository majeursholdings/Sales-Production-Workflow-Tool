import { Card } from "@/components/common/card";
import { LinkButton } from "@/components/common/buttons";
import type { OwedToday } from "@/lib/data/finance";
import { CATEGORY_LABELS, VAT_RATE, naira, type CategoryRow, type EntryKind } from "@/lib/finance";

/** "Where money came from" / "Where money went": each category with its share as a thin bar. */
export function BreakdownCard({
	kind,
	rows,
	total,
	rangeText,
}: {
	kind: EntryKind;
	rows: CategoryRow[];
	total: number;
	rangeText: string;
}) {
	const money = kind === "in";
	const id = money ? "money-in-title" : "money-out-title";

	return (
		<Card aria-labelledby={id}>
			<div className="flex flex-col gap-0.5">
				<h2 id={id}>{money ? "Where money came from" : "Where money went"}</h2>
				<p className="text-small text-fg-tertiary">
					{naira(total)} in {rangeText}
				</p>
			</div>
			{rows.length === 0 ? (
				<p className="text-body text-fg-secondary">
					No {money ? "payments" : "expenses"} in this period.
				</p>
			) : (
				<ul className="flex flex-col">
					{rows.map((row) => (
						<li
							key={row.category}
							className="flex flex-col gap-1.5 border-t border-line py-2.5 first:border-t-0 first:pt-0"
						>
							<span className="flex items-baseline justify-between gap-3">
								<span>{CATEGORY_LABELS[row.category]}</span>
								<strong className="tabular">{naira(row.amount)}</strong>
							</span>
							<span
								aria-hidden="true"
								className={`flex h-1.5 overflow-hidden rounded-full ${money ? "bg-accent-subtle" : "bg-info-subtle"}`}
							>
								<span
									className={`h-full rounded-full ${money ? "bg-accent" : "bg-info-fg"}`}
									style={{ width: `${Math.max(row.share * 100, 1)}%` }}
								/>
							</span>
							<span className="text-small text-fg-tertiary">
								{(row.share * 100).toFixed(1)}% of{" "}
								{money ? "revenue" : "expenditure"} · {row.count}{" "}
								{row.count === 1 ? "entry" : "entries"}
							</span>
						</li>
					))}
				</ul>
			)}
		</Card>
	);
}

/** What clients still owe Majeurs, and what Majeurs still owes suppliers. */
export function OwedCard({ owed }: { owed: OwedToday }) {
	return (
		<Card aria-labelledby="owed-title">
			<h2 id="owed-title">Owed today</h2>
			<div className="flex items-baseline justify-between gap-3">
				<span>Owed to Majeurs</span>
				<b className="font-display text-h2 tabular">{naira(owed.toMajeurs.amount)}</b>
			</div>
			<p className="text-small text-fg-tertiary">
				Balances on {owed.toMajeurs.invoices} part-paid invoices. Due before delivery.
			</p>
			<LinkButton href="/invoices" size="sm" className="self-start">
				Open invoices
			</LinkButton>
			<hr className="border-line" />
			<div className="flex items-baseline justify-between gap-3">
				<span>Owed to suppliers</span>
				<b className="font-display text-h2 tabular">{naira(owed.toSuppliers.amount)}</b>
			</div>
			<p className="text-small text-fg-tertiary">
				{owed.toSuppliers.purchaseOrders} purchase orders sent, part received or awaiting
				approval.
			</p>
			<LinkButton href="/purchase-orders" size="sm" className="self-start">
				Open purchase orders
			</LinkButton>
		</Card>
	);
}

export function VatCard({ vat }: { vat: { collected: number; paid: number; toRemit: number } }) {
	return (
		<Card aria-labelledby="vat-title">
			<h2 id="vat-title">VAT in this period</h2>
			<div className="flex items-baseline justify-between gap-3">
				<span>Collected on client payments</span>
				<strong className="tabular">{naira(vat.collected)}</strong>
			</div>
			<div className="flex items-baseline justify-between gap-3">
				<span>Paid on materials</span>
				<strong className="tabular">{naira(vat.paid)}</strong>
			</div>
			<hr className="border-line" />
			<div className="flex items-baseline justify-between gap-3">
				<strong>To remit</strong>
				<b className="font-display text-h2 tabular">{naira(vat.toRemit)}</b>
			</div>
			<p className="text-small text-fg-tertiary">
				Worked out at {VAT_RATE * 100}% from VAT-inclusive amounts. Check against your VAT
				return before filing.
			</p>
		</Card>
	);
}
