"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button, LinkButton } from "@/components/common/buttons";
import { Card } from "@/components/common/card";
import PageTitle from "@/components/layout/pageTitle";
import Stepper from "@/components/quotes/builder/stepper";
import { DataTable, type ColumnDef } from "@/components/tables";
import { wholeNaira } from "@/lib/quoteBuilder";
import type { MarkupCategory, PricingChange, PricingRule } from "@/lib/pricing";
import { saveCategoryMarkupsAction } from "@/app/(dashboard)/pricing/actions";

export const pricingTitle = {
	pageTitle: "Pricing & margins",
	pageDescription:
		"Price = cost + markup, capped per category. Changes apply to new quotes; sent quotes keep their prices.",
};

/**
 * Category markups, with the Save and Discard buttons in the page title.
 * The buttons and the table share the unsaved changes, so both live here.
 */
export default function PricingContent({
	categories,
	rules,
	history,
}: {
	categories: MarkupCategory[];
	rules: PricingRule[];
	history: PricingChange[];
}) {
	const [saved, setSaved] = useState(() =>
		Object.fromEntries(categories.map((c) => [c.id, c.markup])),
	);
	const [draft, setDraft] = useState(saved);
	const [log, setLog] = useState(history);
	const [saving, setSaving] = useState(false);

	const changed = categories.filter((c) => draft[c.id] !== saved[c.id]);
	const over = categories.filter((c) => draft[c.id] > c.ceiling);

	const save = async () => {
		setSaving(true);
		const result = await saveCategoryMarkupsAction(
			changed.map((c) => ({ id: c.id, markup: draft[c.id] })),
		);
		setSaving(false);
		if (!result.ok) {
			toast.error(result.message);
			return;
		}
		const entries = changed.map((c) => ({
			what: `${c.name} markup ${saved[c.id]}% → ${draft[c.id]}%`,
			who: "You · just now",
		}));
		setLog((l) => [...entries, ...l]);
		setSaved(draft);
		toast.success(
			`Saved. New quotes use the new ${changed.length === 1 ? "markup" : "markups"}; sent quotes keep their prices.`,
		);
	};

	const columns: ColumnDef<MarkupCategory>[] = [
		{
			key: "name",
			header: "Category",
			cell: (c) => <span className="font-bold text-fg">{c.name}</span>,
		},
		{
			key: "types",
			header: "Furniture types",
			className: "text-end",
			cell: (c) => <span className="tabular">{c.types}</span>,
		},
		{
			key: "markup",
			header: "Markup",
			cell: (c) => {
				const pct = draft[c.id];
				const isOver = pct > c.ceiling;
				return (
					<span className="flex flex-col items-start gap-1">
						<Stepper
							value={pct}
							format={(n) => `${n}%`}
							tone={isOver ? "over" : pct !== saved[c.id] ? "changed" : "default"}
							onChange={(n) => setDraft((d) => ({ ...d, [c.id]: Math.max(0, n) }))}
							decreaseLabel={`Lower ${c.name} markup`}
							increaseLabel={`Raise ${c.name} markup`}
						/>
						{isOver && (
							<span className="text-small text-danger-fg">
								Above the {c.ceiling}% ceiling
							</span>
						)}
					</span>
				);
			},
		},
		{
			key: "ceiling",
			header: "Ceiling",
			className: "text-end",
			cell: (c) => <span className="tabular">{c.ceiling}%</span>,
		},
		{
			key: "example",
			header: "Example",
			cell: (c) => (
				<span className="text-small whitespace-nowrap text-fg-secondary tabular">
					Cost {wholeNaira(c.exampleCost)} → price{" "}
					{wholeNaira(c.exampleCost * (1 + draft[c.id] / 100))}
				</span>
			),
		},
	];

	return (
		<>
			<PageTitle
				{...pricingTitle}
				actions={
					<>
						<Button disabled={changed.length === 0} onClick={() => setDraft(saved)}>
							Discard changes
						</Button>
						<Button
							variant="primary"
							disabled={changed.length === 0 || over.length > 0 || saving}
							title={over.length > 0 ? "A markup is above its ceiling" : undefined}
							onClick={save}
						>
							{saving ? "Saving…" : "Save changes"}
						</Button>
					</>
				}
			/>

			<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
				<DataTable
					tableId="markups"
					columns={columns}
					rows={categories}
					toolbar={
						<div className="flex flex-col gap-1 border-b border-line px-5 py-4">
							<h2>Category markups</h2>
							<p className="text-small text-fg-tertiary">
								Accounting, the MD and the GM can change these. Every change is
								logged.
							</p>
						</div>
					}
				/>

				<aside
					aria-label="Pricing rules and history"
					className="flex min-w-0 flex-col gap-6"
				>
					<Card className="gap-0">
						<h2 className="mb-2">Quote rules</h2>
						<dl className="flex flex-col">
							{rules.map((r) => (
								<div
									key={r.label}
									className="flex items-baseline gap-3 border-t border-line py-3 first:border-t-0"
								>
									<dt className="flex flex-1 flex-col">
										<strong className="text-fg">{r.label}</strong>
										<span className="text-small text-fg-tertiary">{r.who}</span>
									</dt>
									<dd className="font-bold whitespace-nowrap text-fg tabular">
										{r.value}
									</dd>
								</div>
							))}
						</dl>
						<div className="pt-3">
							<LinkButton href="/settings/tax" size="sm">
								Change in Settings
							</LinkButton>
						</div>
					</Card>

					<Card className="gap-0">
						<h2 className="mb-2">Change history</h2>
						<ul className="flex flex-col">
							{log.map((h, i) => (
								<li
									key={`${h.what}-${i}`}
									className="flex flex-col border-t border-line py-3 first:border-t-0"
								>
									<strong className="text-fg">{h.what}</strong>
									<span className="text-small text-fg-tertiary">{h.who}</span>
								</li>
							))}
						</ul>
					</Card>
				</aside>
			</div>
		</>
	);
}
