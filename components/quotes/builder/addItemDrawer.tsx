"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/common/buttons";
import { Drawer } from "@/components/common/drawer";
import TypePhoto from "@/components/furniture/typePhoto";
import { SearchInput } from "@/components/forms/input";
import { cn } from "@/lib/cn";
import type { CatalogItem } from "@/lib/quoteBuilder";

/** Pick a furniture type to add to the quote. Its template's parts and hours fill in. */
export default function AddItemDrawer({
	catalog,
	onQuote,
	onAdd,
	onClose,
}: {
	catalog: CatalogItem[];
	/** Furniture type ids already on the quote. */
	onQuote: string[];
	onAdd: (id: string) => void;
	onClose: () => void;
}) {
	const [query, setQuery] = useState("");
	const [picked, setPicked] = useState<string | null>(null);
	const needle = query.trim().toLowerCase();
	const shown = catalog.filter(
		(c) => !needle || `${c.name} ${c.category} ${c.description}`.toLowerCase().includes(needle),
	);

	return (
		<Drawer
			title="Add furniture item"
			description="Pick a furniture type. Its standard parts and hours fill in; change them for this quote after adding."
			onClose={onClose}
			footer={
				<>
					<Button onClick={onClose}>Cancel</Button>
					<Button
						variant="primary"
						disabled={!picked}
						onClick={() => picked && onAdd(picked)}
					>
						Add to quote
					</Button>
				</>
			}
		>
			{catalog.length === 0 ? (
				<p className="text-body text-fg-secondary">
					No furniture types are published yet. They&apos;re set up in{" "}
					<Link href="/furniture-types">Furniture types</Link>.
				</p>
			) : (
				<>
					<SearchInput
						aria-label="Search furniture types"
						className="w-full"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Search furniture types"
					/>
					<ul className="flex flex-col gap-2">
						{shown.length === 0 && (
							<li className="py-6 text-center text-body text-fg-secondary">
								No furniture types match.
							</li>
						)}
						{shown.map((c) => {
							const added = onQuote.includes(c.id);
							return (
								<li key={c.id}>
									<button
										type="button"
										disabled={added}
										aria-pressed={picked === c.id}
										onClick={() => setPicked(c.id)}
										className={cn(
											"flex w-full cursor-pointer items-center gap-3 rounded-md border border-line p-3 text-start hover:bg-subtle",
											"aria-pressed:border-accent aria-pressed:bg-accent-subtle",
											"disabled:cursor-default disabled:opacity-60 disabled:hover:bg-transparent",
										)}
									>
										<TypePhoto category={c.category} />
										<span className="flex min-w-0 flex-1 flex-col">
											<strong>{c.name}</strong>
											<span className="text-small text-fg-secondary">
												{[c.category, c.description]
													.filter(Boolean)
													.join(" · ")}
											</span>
										</span>
										<span className="text-small whitespace-nowrap text-fg-secondary">
											{added ? "On quote" : `${c.parts.length} parts`}
										</span>
									</button>
								</li>
							);
						})}
					</ul>
				</>
			)}
		</Drawer>
	);
}
