"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import Link from "next/link";
import { Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, LinkButton } from "@/components/common/buttons";
import { Card, CardHeader, CardTitle } from "@/components/common/card";
import { SegmentedControl } from "@/components/common/segmented-control";
import { Input, Textarea } from "@/components/forms/input";
import PageTitle from "@/components/layout/pageTitle";
import PageWrapper from "@/components/layout/pageWrapper";
import { IconButton, Table } from "@/components/tables";
import { formatNaira } from "@/lib/currency";
import {
	CATEGORY_MARKUP,
	FURNITURE_CATEGORIES,
	costTemplate,
	percent,
	type FurnitureCategory,
	type InventoryPart,
	type TemplatePart,
} from "@/lib/furnitureTypes";
import QtyStepper from "./qtyStepper";
import TypePhoto from "./typePhoto";

type Values = {
	name: string;
	leadTime: string;
	description: string;
	buildNotes: string;
	standardSize: string;
	cratePieces: string;
};

/** A new furniture type: basics, standard parts from inventory, and notes for production. */
export default function NewFurnitureTypeForm({ inventory }: { inventory: InventoryPart[] }) {
	// TODO: save through the backend once it exists; for now nothing is stored.
	const [category, setCategory] = useState<FurnitureCategory>("Sofas");
	const [parts, setParts] = useState<TemplatePart[]>([]);
	const [query, setQuery] = useState("");
	const [searching, setSearching] = useState(false);
	const [published, setPublished] = useState<string | null>(null);

	const form = useForm<Values>({
		defaultValues: {
			name: "",
			leadTime: "21 working days",
			description: "",
			buildNotes: "",
			standardSize: "",
			cratePieces: "1",
		},
	});

	const { markup, cap } = CATEGORY_MARKUP[category];
	const bySku = new Map(inventory.map((p) => [p.sku, p]));
	const cost = costTemplate({ parts, labour: [], machines: [], extras: [] }, inventory, markup);

	const needle = query.trim().toLowerCase();
	const suggestions = inventory
		.filter((p) => !parts.some((x) => x.sku === p.sku))
		.filter((p) => !needle || `${p.name} ${p.sku}`.toLowerCase().includes(needle))
		.slice(0, 5);

	const addPart = (sku: string) => {
		setParts((list) => [...list, { sku, qty: 1 }]);
		setQuery("");
		setSearching(false);
	};

	const submit = (mode: "draft" | "publish") =>
		form.handleSubmit((values) => {
			const name = values.name.trim();
			if (mode === "draft") {
				setPublished(null);
				toast.success("Draft saved. Only procurement and the MD/GM can see it.");
				return;
			}
			setPublished(name);
			toast.success(
				`${name} is published. Customer care and sales can add it to quotes now.`,
			);
		});

	const hasName = (useWatch({ control: form.control, name: "name" }) ?? "").trim().length > 0;

	return (
		<PageWrapper>
			<PageTitle
				breadcrumbs={[
					{ label: "Furniture types", href: "/furniture-types" },
					{ label: "New furniture type" },
				]}
				pageTitle="New furniture type"
				pageDescription="A template: its parts and quantities fill in when someone adds it to a quote. Customer care and sales can quote it once it's published."
				actions={
					<>
						<Button onClick={submit("draft")}>Save draft</Button>
						<Button
							variant="primary"
							disabled={parts.length === 0 || !hasName}
							title={
								parts.length === 0
									? "Add at least one part to publish"
									: !hasName
										? "Give the type a name to publish"
										: undefined
							}
							onClick={submit("publish")}
						>
							Publish type
						</Button>
					</>
				}
			/>

			{published && (
				<div
					role="status"
					className="flex flex-wrap items-center gap-3 rounded-md border border-success-line bg-success-subtle px-4 py-3 text-body text-fg"
				>
					<span className="min-w-0 flex-1">
						<strong>{published}</strong> is published. Customer care and sales can add
						it to quotes now.
					</span>
					<LinkButton href="/furniture-types" size="sm">
						View in Furniture types
					</LinkButton>
				</div>
			)}

			<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
				<div className="flex min-w-0 flex-col gap-6">
					<Card className="gap-5" aria-labelledby="basics-title">
						<h2 id="basics-title">Basics</h2>
						<div className="grid gap-4 sm:grid-cols-2">
							<Input
								label="Name"
								placeholder="As it appears on quotes"
								{...form.register("name", { required: "Give the type a name." })}
								error={form.formState.errors.name?.message}
							/>
							<Input
								label="Lead time"
								hint="From deposit to ready for delivery."
								{...form.register("leadTime")}
							/>
						</div>

						<div className="flex flex-col gap-2">
							<span id="category-label" className="text-body font-bold">
								Category
							</span>
							<SegmentedControl<FurnitureCategory>
								label="Category"
								value={category}
								onChange={setCategory}
								options={FURNITURE_CATEGORIES.map((c) => ({ value: c, label: c }))}
							/>
							<small className="text-small text-fg-tertiary">
								Sets the default markup ({percent(markup)}) and margin cap (
								{percent(cap)}) from Pricing &amp; margins.
							</small>
						</div>

						<Textarea
							label="Description on quotes"
							hint="Customer care can edit it per quote."
							{...form.register("description")}
						/>

						<div className="flex flex-col gap-2">
							<span className="text-body font-bold">Photos</span>
							<div className="flex flex-wrap items-center gap-3">
								<TypePhoto
									category={category}
									size="lg"
									label="Placeholder cover photo"
								/>
								<Button disabled title="Photo upload isn't connected yet">
									<Plus />
									Add photos
								</Button>
							</div>
							<small className="text-small text-fg-tertiary">
								Up to 6. The first is the cover, shown when picking items on a
								quote, on job cards and in Furniture types. Photo upload isn&apos;t
								connected yet.
							</small>
						</div>
					</Card>

					<Card flush aria-labelledby="new-parts-title">
						<CardHeader>
							<CardTitle id="new-parts-title" className="flex-1">
								Standard parts
							</CardTitle>
							<span className="text-small text-fg-tertiary">
								{parts.length} parts per piece
							</span>
						</CardHeader>

						<div className="flex flex-col gap-2 border-b border-line px-5 py-4">
							<label className="flex h-10 items-center gap-2 rounded-md border border-line-control bg-surface px-3 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus">
								<Search
									aria-hidden="true"
									className="size-4 shrink-0 text-fg-tertiary"
								/>
								<span className="sr-only">Add a part from inventory</span>
								<input
									type="search"
									value={query}
									onChange={(e) => setQuery(e.target.value)}
									onFocus={() => setSearching(true)}
									onBlur={() => setSearching(false)}
									placeholder="Add a part from inventory: name or code"
									className="min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-fg-tertiary"
								/>
							</label>
							{(searching || needle) && (
								<div
									role="listbox"
									aria-label="Matching parts"
									// keeps the input focused, so a click reaches the option before the list closes
									onMouseDown={(e) => e.preventDefault()}
									className="flex flex-col rounded-md border border-line bg-surface p-1 shadow-[0_8px_24px_rgb(33_29_26/0.08)]"
								>
									{suggestions.length === 0 && (
										<p className="px-3 py-2 text-small text-fg-secondary">
											No inventory parts match.
										</p>
									)}
									{suggestions.map((p) => (
										<button
											key={p.sku}
											type="button"
											role="option"
											aria-selected={false}
											onClick={() => addPart(p.sku)}
											className="flex cursor-pointer items-center gap-3 rounded-sm px-3 py-2 text-start hover:bg-subtle"
										>
											<span className="flex min-w-0 flex-1 flex-col">
												<strong>{p.name}</strong>
												<span className="text-small text-fg-secondary">
													{p.sku} · {p.spec} · {p.stock}
												</span>
											</span>
											<span className="text-small text-fg-secondary tabular">
												{formatNaira(p.unitCost)}
											</span>
										</button>
									))}
									<div role="separator" className="my-1 h-px bg-line" />
									<Link
										href="/inventory"
										className="flex items-center gap-2 rounded-sm px-3 py-2 text-body no-underline hover:bg-subtle"
									>
										<Plus aria-hidden="true" className="size-4" />
										Part isn&apos;t in inventory? Add it first
									</Link>
								</div>
							)}
						</div>

						{parts.length > 0 ? (
							<Table className="min-w-140">
								<thead>
									<tr>
										<th scope="col">Part</th>
										<th scope="col">Spec</th>
										<th scope="col">Qty per piece</th>
										<th scope="col" className="text-end">
											Unit cost
										</th>
										<th scope="col" className="text-end">
											Line cost
										</th>
										<th scope="col" className="w-10">
											<span className="sr-only">Remove</span>
										</th>
									</tr>
								</thead>
								<tbody>
									{parts.map((p) => {
										const item = bySku.get(p.sku);
										if (!item) return null;
										return (
											<tr key={p.sku}>
												<td>
													<span className="flex flex-col">
														<span className="font-bold text-fg">
															{item.name}
														</span>
														<span className="text-small text-fg-tertiary">
															{p.sku}
														</span>
													</span>
												</td>
												<td>{item.spec}</td>
												<td>
													<QtyStepper
														value={p.qty}
														onChange={(qty) =>
															setParts((list) =>
																list.map((x) =>
																	x.sku === p.sku
																		? { ...x, qty }
																		: x,
																),
															)
														}
														decLabel={`Fewer ${item.name}`}
														incLabel={`More ${item.name}`}
														unit={`${item.unit}s`}
													/>
												</td>
												<td className="text-end tabular">
													{formatNaira(item.unitCost)}
												</td>
												<td className="text-end font-bold text-fg tabular">
													{formatNaira(item.unitCost * p.qty)}
												</td>
												<td>
													<IconButton
														danger
														aria-label={`Remove ${item.name}`}
														title="Remove part"
														onClick={() =>
															setParts((list) =>
																list.filter((x) => x.sku !== p.sku),
															)
														}
													>
														<Trash2 aria-hidden="true" />
													</IconButton>
												</td>
											</tr>
										);
									})}
								</tbody>
							</Table>
						) : (
							<p className="px-5 py-6 text-center text-body text-fg-secondary">
								Add at least one part to publish this type.
							</p>
						)}
					</Card>

					<Card className="gap-4" aria-labelledby="production-title">
						<h2 id="production-title">For production</h2>
						<Textarea
							label="Build notes"
							hint="Shown on every job card made from this type. Production sees parts and quantities but not costs."
							{...form.register("buildNotes")}
						/>
						<div className="grid gap-4 sm:grid-cols-2">
							<Input
								label="Standard size"
								placeholder="e.g. 240 × 95 × 78 cm"
								{...form.register("standardSize")}
							/>
							<Input
								label="Pieces per delivery crate"
								inputMode="numeric"
								{...form.register("cratePieces")}
							/>
						</div>
					</Card>
				</div>

				<aside aria-label="Summary" className="flex min-w-0 flex-col gap-6">
					<Card className="gap-3" aria-labelledby="price-title">
						<h2 id="price-title">Cost and price per piece</h2>
						<dl className="flex flex-col gap-3 text-body">
							<div className="flex justify-between gap-3">
								<dt className="text-fg-secondary">Parts cost</dt>
								<dd className="tabular">{formatNaira(cost.parts)}</dd>
							</div>
							<div className="flex justify-between gap-3">
								<dt className="text-fg-secondary">Markup ({percent(markup)})</dt>
								<dd className="tabular">{formatNaira(cost.parts * markup)}</dd>
							</div>
							<div className="flex items-baseline justify-between gap-3 border-t border-line pt-3 font-bold">
								<dt>Price before VAT</dt>
								<dd className="font-display text-h2 tabular">
									{formatNaira(cost.parts * (1 + markup))}
								</dd>
							</div>
						</dl>
						<p className="text-small text-fg-tertiary">
							Labour, machine time and other costs are added on the type&apos;s page
							once it&apos;s saved. Customer care can raise the markup on a quote up
							to the {percent(cap)} cap. Trade discounts apply on top.
						</p>
					</Card>

					<Card className="gap-3" aria-labelledby="who-title">
						<h2 id="who-title">Who can see it</h2>
						<dl className="flex flex-col gap-2 text-body">
							<Who label="Customer care, sales" value="Quote it, see costs" />
							<Who label="Production" value="Parts and notes, no costs" />
							<Who label="Accounting, MD/GM" value="Everything" />
						</dl>
					</Card>
				</aside>
			</div>
		</PageWrapper>
	);
}

function Who({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex flex-wrap justify-between gap-x-3">
			<dt className="text-fg-secondary">{label}</dt>
			<dd className="text-end text-fg">{value}</dd>
		</div>
	);
}
