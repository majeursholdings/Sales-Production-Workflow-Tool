"use client";

import { useState } from "react";
import { Button } from "@/components/common/buttons";
import { Drawer } from "@/components/common/drawer";
import { controlClass } from "@/components/forms/input";
import { cn } from "@/lib/cn";
import { PO_APPROVAL_LIMIT, costLabel, type OrderGroup } from "@/lib/inventory";
import { plural } from "@/lib/suppliers";
import PartThumb from "./partThumb";

const money = (n: number) =>
	`₦${n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Suggested draft orders, one per supplier: untick a supplier or change quantities, then create the drafts. */
export default function RaiseOrdersDrawer({
	groups,
	onCreate,
	onClose,
}: {
	groups: OrderGroup[];
	/** The ticked groups with the quantities as set. */
	onCreate: (groups: OrderGroup[]) => void;
	onClose: () => void;
}) {
	const [off, setOff] = useState<Set<string>>(new Set());
	const [qty, setQty] = useState<Record<string, string>>(() =>
		Object.fromEntries(groups.flatMap((g) => g.lines.map((l) => [l.sku, String(l.qty)]))),
	);

	const qtyOf = (sku: string) => {
		const n = Number(qty[sku]);
		return Number.isInteger(n) && n > 0 ? n : 0;
	};
	const totalOf = (g: OrderGroup) => g.lines.reduce((sum, l) => sum + qtyOf(l.sku) * l.price, 0);

	const picked = groups
		.filter((g) => !off.has(g.supplierId))
		.map((g) => ({
			...g,
			lines: g.lines.map((l) => ({ ...l, qty: qtyOf(l.sku) })).filter((l) => l.qty > 0),
		}))
		.filter((g) => g.lines.length > 0);
	const overLimit = picked.filter((g) => totalOf(g) > PO_APPROVAL_LIMIT);

	const toggle = (id: string) =>
		setOff((s) => {
			const next = new Set(s);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});

	return (
		<Drawer
			title="Raise purchase orders"
			description="Parts short for job cards or at their reorder level, grouped by supplier. One draft order per supplier."
			onClose={onClose}
			footer={
				<>
					<span className="flex-1" />
					<Button onClick={onClose}>Cancel</Button>
					<Button
						variant="primary"
						disabled={picked.length === 0}
						onClick={() => onCreate(picked)}
					>
						{picked.length === 0
							? "Create draft orders"
							: `Create ${plural(picked.length, "draft order")}`}
					</Button>
				</>
			}
		>
			{groups.length === 0 && (
				<p className="text-body text-fg-secondary">
					Nothing to order: no part is short for a job card or at its reorder level.
				</p>
			)}

			{groups.map((g) => {
				const on = !off.has(g.supplierId);
				const checkboxId = `raise-${g.supplierId}`;
				return (
					<section
						key={g.supplierId}
						aria-labelledby={`${checkboxId}-label`}
						className={cn(
							"overflow-hidden rounded-md border border-line",
							!on && "opacity-60",
						)}
					>
						<div className="flex items-center gap-3 bg-subtle px-4 py-3">
							<input
								id={checkboxId}
								type="checkbox"
								checked={on}
								onChange={() => toggle(g.supplierId)}
								className="size-4.5 shrink-0 accent-accent"
							/>
							<label
								id={`${checkboxId}-label`}
								htmlFor={checkboxId}
								className="flex min-w-0 flex-1 cursor-pointer flex-col"
							>
								<strong className="text-fg">{g.supplier}</strong>
								<span className="text-small text-fg-secondary">{g.meta}</span>
							</label>
							<strong className="text-fg tabular">{money(totalOf(g))}</strong>
						</div>
						{g.lines.map((l) => (
							<div
								key={l.sku}
								className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-3"
							>
								<PartThumb part={l} />
								<span className="flex min-w-40 flex-1 flex-col">
									<strong className="text-fg">{l.name}</strong>
									<span className="text-small text-fg-secondary">{l.why}</span>
								</span>
								<label className="flex items-center gap-2">
									<span className="sr-only">{l.name} quantity</span>
									<input
										value={qty[l.sku] ?? ""}
										onChange={(e) =>
											setQty((q) => ({
												...q,
												[l.sku]: e.target.value.replace(/\D/g, ""),
											}))
										}
										inputMode="numeric"
										disabled={!on}
										aria-invalid={on && qtyOf(l.sku) === 0}
										className={cn(controlClass, "h-10 w-20 text-end tabular")}
									/>
									<span className="w-14 text-small text-fg-secondary">
										{qtyOf(l.sku) === 1 ? l.unit : `${l.unit}s`}
									</span>
								</label>
								<span className="w-28 text-end text-fg tabular">
									{money(qtyOf(l.sku) * l.price)}
									<span className="block text-small text-fg-tertiary">
										at {costLabel(l.price)}
									</span>
								</span>
							</div>
						))}
					</section>
				);
			})}

			<p className="text-small text-fg-secondary">
				Quantities include the reorder level. Change them here or on each draft before
				sending. Orders over {costLabel(PO_APPROVAL_LIMIT)} need MD or GM approval.
			</p>
			{overLimit.length > 0 && (
				<p
					role="status"
					className="rounded-md border border-warning-line bg-warning-subtle p-3 text-small text-fg"
				>
					{overLimit.map((g) => g.supplier).join(" and ")}{" "}
					{overLimit.length === 1 ? "is" : "are"} over {costLabel(PO_APPROVAL_LIMIT)} and
					will go to MD or GM for approval.
				</p>
			)}
		</Drawer>
	);
}
