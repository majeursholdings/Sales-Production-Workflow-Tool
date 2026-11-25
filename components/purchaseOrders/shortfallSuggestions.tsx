"use client";

import Link from "next/link";
import { Button } from "@/components/common/buttons";
import PartThumb from "@/components/inventory/partThumb";
import { DataTable, type ColumnDef } from "@/components/tables";
import { cn } from "@/lib/cn";
import { shortfallsOf, type Inventory, type OrderGroup } from "@/lib/inventory";
import { money, unitQty } from "@/lib/purchaseOrders";
import { formatScore, offersFor, scoreOf, type SupplierCatalog } from "@/lib/suppliers";

/** One suggested line: a part a job card is short of, not yet on any order. */
type Suggestion = {
	id: string;
	sku: string;
	name: string;
	spec: string;
	unit: string;
	jobCard: string;
	client: string;
	short: number;
	qty: number;
	price: number;
	supplierId: string;
	supplierName: string;
	supplierCount: number;
	score: number | null;
	onTimePercent: number;
};

export function shortfallSuggestions(
	inventory: Inventory,
	catalog: SupplierCatalog,
	onOrder: Set<string>,
): Suggestion[] {
	return shortfallsOf(inventory)
		.filter((s) => !onOrder.has(s.sku))
		.flatMap((s) => {
			const part = inventory.parts.find((p) => p.sku === s.sku);
			if (!part) return [];
			const supplier = catalog.suppliers.find((x) => x.id === part.supplierId);
			const offers = offersFor(catalog, part.sku);
			const offer = offers.find((o) => o.supplier.id === part.supplierId);
			return [
				{
					id: `${s.jobCard}-${part.sku}`,
					sku: part.sku,
					name: part.name,
					spec: part.spec,
					unit: part.unit,
					jobCard: s.jobCard,
					client: s.client,
					short: s.short,
					qty: s.short + part.reorderLevel,
					price: offer?.price ?? part.unitCost,
					supplierId: part.supplierId,
					supplierName: supplier?.business ?? "No supplier set",
					supplierCount: offers.length,
					score: scoreOf(offer?.ratings ?? null),
					onTimePercent: supplier?.onTimePercent ?? 100,
				},
			];
		});
}

/** The suggestions as one draft order per supplier. */
export function suggestionGroups(suggestions: Suggestion[]): OrderGroup[] {
	const groups = new Map<string, OrderGroup>();
	for (const s of suggestions) {
		const g = groups.get(s.supplierId) ?? {
			supplierId: s.supplierId,
			supplier: s.supplierName,
			meta: "",
			lines: [],
		};
		g.lines.push({
			sku: s.sku,
			name: s.name,
			unit: s.unit,
			why: "",
			qty: s.qty,
			price: s.price,
		});
		groups.set(s.supplierId, g);
	}
	return [...groups.values()];
}

const columns: ColumnDef<Suggestion>[] = [
	{
		key: "part",
		header: "Part",
		cell: (s) => (
			<span className="flex min-w-48 items-center gap-3">
				<PartThumb part={s} />
				<span className="flex flex-col">
					<strong className="text-fg">{s.name}</strong>
					<span className="text-small text-fg-tertiary">
						{s.sku} · {s.spec}
					</span>
				</span>
			</span>
		),
	},
	{
		key: "for",
		header: "Needed for",
		cell: (s) => (
			<span className="flex flex-col">
				<Link href={`/work-orders/${s.jobCard}`} className="text-fg">
					{s.jobCard}
				</Link>
				<span className="text-small text-fg-tertiary">{s.client}</span>
			</span>
		),
	},
	{
		key: "order",
		header: "Order",
		className: "text-end",
		cell: (s) => (
			<span className="flex flex-col items-end">
				<strong className="whitespace-nowrap text-fg tabular">
					{unitQty(s.qty, s.unit)}
				</strong>
				<span className="text-small whitespace-nowrap text-fg-tertiary">
					{unitQty(s.short, s.unit)} short + reorder level
				</span>
			</span>
		),
	},
	{
		key: "supplier",
		header: "Supplier",
		cell: (s) => {
			const weak = s.score !== null && s.score < 3;
			return (
				<span className="flex min-w-48 flex-col">
					<Link href={`/suppliers/${s.supplierId}`} className="font-bold text-fg">
						{s.supplierName}
					</Link>
					<span
						className={cn("text-small", weak ? "text-danger-fg" : "text-fg-tertiary")}
					>
						{s.supplierCount > 1 ? "Preferred" : "Only supplier"}
						{s.score !== null && ` · scores ${formatScore(s.score)} for this part`}
						{s.onTimePercent < 60 && ", often late"}
						{s.supplierCount > 1 && (
							<>
								{" · "}
								<Link href={`/suppliers/${s.supplierId}`}>
									compare {s.supplierCount} suppliers
								</Link>
							</>
						)}
					</span>
				</span>
			);
		},
	},
	{
		key: "estimate",
		header: "Estimate",
		className: "text-end",
		cell: (s) => (
			<strong className="whitespace-nowrap text-fg tabular">{money(s.qty * s.price)}</strong>
		),
	},
];

/** "Suggested from the shortfall list": parts confirmed job cards need, ready to turn into drafts. */
export default function ShortfallSuggestions({
	suggestions,
	onCreate,
}: {
	suggestions: Suggestion[];
	onCreate: () => void;
}) {
	const draftCount = new Set(suggestions.map((s) => s.supplierId)).size;
	const onlySupplier = suggestions.filter((s) => s.supplierCount <= 1);

	return (
		<section aria-labelledby="suggest-title" className="flex flex-col gap-3">
			<DataTable
				tableId="shortfall-suggestions"
				columns={columns}
				rows={suggestions}
				toolbar={
					<div className="flex flex-wrap items-start gap-3 border-b border-line px-5 py-4">
						<div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1">
							<h2 id="suggest-title">Suggested from the shortfall list</h2>
							<p className="text-body text-fg-secondary">
								Confirmed job cards need these parts. Quantities include each
								part&apos;s reorder level.
							</p>
						</div>
						<Button variant="primary" onClick={onCreate}>
							Create {draftCount} draft order{draftCount === 1 ? "" : "s"}
						</Button>
					</div>
				}
			/>
			<p className="text-small text-fg-secondary">
				Each part is ordered from its preferred supplier.
				{onlySupplier.map((s) => (
					<span key={s.id}>
						{" "}
						{s.supplierName} is the only supplier of {s.name.toLowerCase()}; add another
						on <Link href="/suppliers">Suppliers</Link> to get a choice.
					</span>
				))}
			</p>
		</section>
	);
}
