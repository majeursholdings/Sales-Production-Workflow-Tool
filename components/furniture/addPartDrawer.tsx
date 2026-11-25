"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/common/buttons";
import { Drawer } from "@/components/common/drawer";
import { cn } from "@/lib/cn";
import { formatNaira } from "@/lib/currency";
import type { InventoryPart } from "@/lib/furnitureTypes";
import QtyStepper from "./qtyStepper";

/** Pick a part from inventory and say how many go into one piece. */
export default function AddPartDrawer({
	typeName,
	inventory,
	inTemplate,
	showCost,
	onAdd,
	onClose,
}: {
	typeName: string;
	inventory: InventoryPart[];
	/** SKUs already on the template. */
	inTemplate: string[];
	showCost: boolean;
	onAdd: (sku: string, qty: number) => void;
	onClose: () => void;
}) {
	const [query, setQuery] = useState("");
	const [category, setCategory] = useState<string>("All");
	const [picked, setPicked] = useState<InventoryPart | null>(null);
	const [qty, setQty] = useState(1);

	const categories = [...new Set(inventory.map((p) => p.category))].sort();
	const needle = query.trim().toLowerCase();
	const shown = inventory.filter(
		(p) =>
			(category === "All" || p.category === category) &&
			(!needle || `${p.name} ${p.sku}`.toLowerCase().includes(needle)),
	);

	return (
		<Drawer
			title={`Add part to ${typeName.toLowerCase()}`}
			description={
				showCost
					? "Pick from inventory. Unit costs come from the procurement price list."
					: "Pick from inventory and set how many go into one piece."
			}
			onClose={onClose}
			footer={
				<>
					<span className="min-w-0 flex-1 text-body">
						{picked ? (
							<span className="flex flex-wrap items-center gap-x-4 gap-y-2">
								<strong>{picked.name}</strong>
								<QtyStepper
									value={qty}
									onChange={setQty}
									decLabel={`Fewer ${picked.name}`}
									incLabel={`More ${picked.name}`}
									unit={`${picked.unit}s per piece`}
								/>
								{showCost && (
									<span className="text-fg-secondary tabular">
										{formatNaira(picked.unitCost * qty)}
									</span>
								)}
							</span>
						) : (
							<span className="text-fg-tertiary">Pick a part to continue.</span>
						)}
					</span>
					<Button onClick={onClose}>Cancel</Button>
					<Button
						variant="primary"
						disabled={!picked}
						onClick={() => picked && onAdd(picked.sku, qty)}
					>
						Add part
					</Button>
				</>
			}
		>
			<label className="flex h-10 items-center gap-2 rounded-md border border-line-control bg-surface px-3 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus">
				<Search aria-hidden="true" className="size-4 shrink-0 text-fg-tertiary" />
				<span className="sr-only">Search inventory</span>
				<input
					type="search"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder="Search parts or SKU"
					className="min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-fg-tertiary"
				/>
			</label>
			<label className="flex items-center gap-2 text-small text-fg-secondary">
				Category
				<select
					value={category}
					onChange={(e) => setCategory(e.target.value)}
					className="h-10 rounded-md border border-line-control bg-surface px-3 text-body text-fg"
				>
					<option value="All">All</option>
					{categories.map((c) => (
						<option key={c} value={c}>
							{c}
						</option>
					))}
				</select>
			</label>

			<ul className="flex flex-col gap-2">
				{shown.length === 0 && (
					<li className="py-6 text-center text-body text-fg-secondary">
						{inventory.length === 0
							? "Inventory is empty. Add parts in Inventory first."
							: "No inventory parts match."}
					</li>
				)}
				{shown.map((p) => {
					const added = inTemplate.includes(p.sku);
					return (
						<li key={p.sku}>
							<button
								type="button"
								disabled={added}
								aria-pressed={picked?.sku === p.sku}
								onClick={() => {
									setPicked(p);
									setQty(1);
								}}
								className={cn(
									"flex w-full cursor-pointer items-center gap-3 rounded-md border border-line p-3 text-start hover:bg-subtle",
									"aria-pressed:border-accent aria-pressed:bg-accent-subtle",
									"disabled:cursor-default disabled:opacity-60 disabled:hover:bg-transparent",
								)}
							>
								<span
									aria-hidden="true"
									className="grid size-10 shrink-0 place-items-center rounded-md bg-subtle text-small font-bold text-fg-secondary"
								>
									{p.category.slice(0, 2)}
								</span>
								<span className="flex min-w-0 flex-1 flex-col">
									<strong>{p.name}</strong>
									<span className="text-small text-fg-secondary">
										{[p.sku, p.spec, `${p.available} available`]
											.filter(Boolean)
											.join(" · ")}
									</span>
								</span>
								<span className="text-small whitespace-nowrap text-fg-secondary">
									{added
										? "In template"
										: showCost
											? `${formatNaira(p.unitCost)} / ${p.unit}`
											: `per ${p.unit}`}
								</span>
							</button>
						</li>
					);
				})}
			</ul>
		</Drawer>
	);
}
