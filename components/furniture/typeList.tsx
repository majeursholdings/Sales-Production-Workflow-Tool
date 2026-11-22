"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Badge } from "@/components/common/badge";
import { Card } from "@/components/common/card";
import { cn } from "@/lib/cn";
import { CATEGORY_MARKUP, percent, type FurnitureTypeSummary } from "@/lib/furnitureTypes";
import type { FurnitureCategory } from "@/lib/furnitureTypes";
import TypePhoto from "./typePhoto";

type Group = { category: FurnitureCategory; types: FurnitureTypeSummary[] };

/** Furniture types grouped by category, with a search box. Picking one shows its template. */
export default function TypeList({
	groups,
	partCounts,
	selectedId,
	onSelect,
	showMarkup,
}: {
	groups: Group[];
	/** Parts per piece, by type id. */
	partCounts: Record<string, number>;
	selectedId: string;
	onSelect: (id: string) => void;
	showMarkup: boolean;
}) {
	const [query, setQuery] = useState("");
	const needle = query.trim().toLowerCase();
	const shown = groups
		.map((g) => ({
			...g,
			types: g.types.filter(
				(t) => !needle || `${t.name} ${t.category}`.toLowerCase().includes(needle),
			),
		}))
		.filter((g) => g.types.length > 0);

	return (
		<Card flush className="min-w-0 flex-1 basis-72 overflow-hidden lg:max-w-sm">
			<div className="border-b border-line px-5 py-4">
				<label className="flex h-10 items-center gap-2 rounded-md border border-line-control bg-surface px-3 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus">
					<Search aria-hidden="true" className="size-4 shrink-0 text-fg-tertiary" />
					<span className="sr-only">Search furniture types</span>
					<input
						type="search"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Search furniture types"
						className="min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-fg-tertiary"
					/>
				</label>
			</div>

			<div className="flex flex-col">
				{shown.length === 0 && (
					<p className="px-5 py-8 text-center text-body text-fg-secondary">
						No furniture types match &ldquo;{query}&rdquo;.
					</p>
				)}
				{shown.map((group) => (
					<div
						key={group.category}
						role="group"
						aria-label={
							group.category +
							(showMarkup
								? `, ${percent(CATEGORY_MARKUP[group.category].markup)} markup`
								: "")
						}
						className="border-b border-line last:border-b-0"
					>
						<div className="flex items-center gap-2 px-5 pt-4 pb-2">
							<b>{group.category}</b>
							{showMarkup && (
								<Badge variant="neutral">
									{percent(CATEGORY_MARKUP[group.category].markup)} markup
								</Badge>
							)}
							<span className="ms-auto text-small text-fg-tertiary">
								{group.types.length} {group.types.length === 1 ? "type" : "types"}
							</span>
						</div>
						<ul className="flex flex-col gap-0.5 px-2 pb-2">
							{group.types.map((t) => (
								<li key={t.id}>
									<button
										type="button"
										aria-pressed={t.id === selectedId}
										onClick={() => onSelect(t.id)}
										className={cn(
											"flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-start text-body hover:bg-subtle",
											"aria-pressed:bg-accent-subtle aria-pressed:font-bold aria-pressed:text-accent-fg",
										)}
									>
										<TypePhoto category={t.category} />
										<span className="min-w-0 flex-1">{t.name}</span>
										<span className="text-small font-normal text-fg-tertiary">
											{partCounts[t.id]} parts
										</span>
									</button>
								</li>
							))}
						</ul>
					</div>
				))}
			</div>
		</Card>
	);
}
