"use client";

import Link from "next/link";
import { Card } from "@/components/common/card";
import { SegmentedControl } from "@/components/common/segmented-control";
import { cn } from "@/lib/cn";
import {
	DEPOSIT_RATE,
	USD_RATE,
	formatMoney,
	type Currency,
	type Pricing,
} from "@/lib/quoteBuilder";
import { VAT_RATE } from "@/lib/quotes";
import { updateDraft } from "@/lib/quoteDraft";

function Row({
	label,
	value,
	bold,
	accent,
}: {
	label: string;
	value: string;
	bold?: boolean;
	accent?: boolean;
}) {
	return (
		<div className={cn("flex justify-between gap-3 text-body", bold && "font-bold")}>
			<span className={bold ? "text-fg" : "text-fg-secondary"}>{label}</span>
			<span className={cn("tabular", accent && "text-success-fg")}>{value}</span>
		</div>
	);
}

/** "Quote summary": cost build-up, markup, discount, VAT and the total, in naira or dollars. */
export default function SummaryCard({
	pricing,
	currency,
}: {
	pricing: Pricing;
	currency: Currency;
}) {
	const m = (n: number) => formatMoney(n, currency);
	return (
		<Card className="gap-2">
			<div className="mb-1 flex items-center gap-3">
				<h2 className="flex-1">Quote summary</h2>
				<SegmentedControl<Currency>
					label="Display currency"
					value={currency}
					onChange={(c) => updateDraft({ currency: c })}
					options={[
						{ value: "NGN", label: "₦ NGN" },
						{ value: "USD", label: "$ USD" },
					]}
				/>
			</div>
			<Row label="Parts" value={m(pricing.partsTotal)} />
			<Row label="Labour" value={m(pricing.labourTotal)} />
			<Row label="Machines" value={m(pricing.machineTotal)} />
			<Row label="Workshop overhead" value={m(pricing.overheadTotal)} />
			<Row label="Other and project costs" value={m(pricing.otherTotal)} />
			<Row label="Contingency (5%)" value={m(pricing.contingency)} />
			<Row bold label="Total cost" value={m(pricing.totalCost)} />
			<Row label="Markup on furniture" value={m(pricing.markup)} />
			{pricing.discountPercent > 0 && (
				<Row
					accent
					label={`Discount (${pricing.discountPercent}%)`}
					value={`− ${m(pricing.discount)}`}
				/>
			)}
			<div className="my-1 h-px bg-line" />
			<Row bold label="Subtotal" value={m(pricing.subtotal)} />
			<Row label={`VAT (${VAT_RATE * 100}%)`} value={m(pricing.vat)} />
			<div className="my-1 h-px bg-line" />
			<div className="flex items-baseline justify-between gap-3 font-bold">
				<span>Total</span>
				<span className="font-display text-total tabular">{m(pricing.total)}</span>
			</div>
			<p className="text-small text-fg-tertiary">
				{currency === "USD"
					? `Shown at today’s example rate (₦${USD_RATE.toLocaleString("en-NG")} = $1). The rate locks when the quote is sent.`
					: `≈ ${formatMoney(pricing.total, "USD")} at today’s example rate (₦${USD_RATE.toLocaleString("en-NG")} = $1).`}
			</p>
			<div className="mt-1 flex flex-col gap-1 rounded-md bg-accent-subtle p-3">
				<div className="flex justify-between gap-3 font-bold text-accent-fg">
					<span>Deposit to confirm ({Math.round(DEPOSIT_RATE * 100)}%)</span>
					<span className="tabular">{m(pricing.deposit)}</span>
				</div>
				<p className="text-small text-fg-secondary">
					Job card, stock reservation and procurement start once the deposit is recorded.
					The rate is set in <Link href="/settings/tax">Settings</Link>.
				</p>
			</div>
		</Card>
	);
}
