"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { saveFurnitureTypeAction } from "@/app/(dashboard)/furniture-types/actions";
import { Button, LinkButton } from "@/components/common/buttons";
import { Card, CardHeader, CardTitle } from "@/components/common/card";
import { IMAGE_ACCEPT } from "@/components/forms/fileRules";
import { Input, Select, Textarea } from "@/components/forms/input";
import PageTitle from "@/components/layout/pageTitle";
import PageWrapper from "@/components/layout/pageWrapper";
import { IconButton, Table } from "@/components/tables";
import { formatNaira } from "@/lib/currency";
import { MAX_PHOTOS_PER_UPLOAD, MAX_PHOTO_BYTES, resolvePhotoType } from "@/lib/storage";
import { uploadStorageFiles } from "@/lib/storageClient";
import {
	costTemplate,
	percent,
	type CostingRates,
	type FurnitureCategory,
	type FurnitureTypeStatus,
	type InventoryPart,
	type TemplatePart,
} from "@/lib/furnitureTypes";
import AddCategoryDrawer from "./addCategoryDrawer";
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
export default function NewFurnitureTypeForm({
	categories,
	inventory,
	rates,
	canAddCategory,
	showCost,
}: {
	categories: FurnitureCategory[];
	inventory: InventoryPart[];
	rates: CostingRates;
	/** Pricing & margins editors can add a category here. */
	canAddCategory: boolean;
	/** Unit costs and prices. Hidden from production. */
	showCost: boolean;
}) {
	const router = useRouter();
	const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
	const [parts, setParts] = useState<TemplatePart[]>([]);
	const [photos, setPhotos] = useState<{ previewUrl: string; file: File }[]>([]);
	const photosRef = useRef(photos);
	const photoInputRef = useRef<HTMLInputElement>(null);
	const [query, setQuery] = useState("");
	const [searching, setSearching] = useState(false);
	const [addingCategory, setAddingCategory] = useState(false);
	const [saving, startSaving] = useTransition();

	useEffect(() => {
		photosRef.current = photos;
	}, [photos]);

	useEffect(
		() => () => {
			for (const item of photosRef.current) URL.revokeObjectURL(item.previewUrl);
		},
		[],
	);

	const pickPhotos = (files: FileList | null) => {
		if (!files?.length) return;
		const remaining = MAX_PHOTOS_PER_UPLOAD - photos.length;
		if (remaining <= 0) {
			toast.error(`You can attach up to ${MAX_PHOTOS_PER_UPLOAD} photos.`);
			return;
		}
		const added: { previewUrl: string; file: File }[] = [];
		for (const file of Array.from(files).slice(0, remaining)) {
			if (file.size > MAX_PHOTO_BYTES) {
				toast.error(`${file.name} is larger than 10 MB.`);
				continue;
			}
			if (!resolvePhotoType(file)) {
				toast.error(`${file.name} isn't a supported image.`);
				continue;
			}
			added.push({ previewUrl: URL.createObjectURL(file), file });
		}
		if (files.length > remaining) {
			toast.info(
				`Kept the first ${remaining} photo${remaining === 1 ? "" : "s"} (max ${MAX_PHOTOS_PER_UPLOAD}).`,
			);
		}
		if (added.length > 0) setPhotos((list) => [...list, ...added]);
	};

	const removePhoto = (previewUrl: string) => {
		URL.revokeObjectURL(previewUrl);
		setPhotos((list) => list.filter((p) => p.previewUrl !== previewUrl));
	};

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

	// A category added in the drawer arrives with the refreshed props
	const category = categories.find((c) => c.id === categoryId) ?? categories[0];
	const markup = category?.markup ?? 0;
	const cap = category?.cap ?? 0;
	const bySku = new Map(inventory.map((p) => [p.sku, p]));
	const cost = costTemplate(
		{ parts, labour: [], machines: [], extras: [] },
		inventory,
		markup,
		rates,
	);

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

	const submit = (status: FurnitureTypeStatus) =>
		form.handleSubmit((values) => {
			if (!category) {
				toast.error("Pick a category first.");
				return;
			}
			startSaving(async () => {
				const name = values.name.trim();
				let uploadedUrls: string[] = [];
				if (photos.length > 0) {
					const uploaded = await uploadStorageFiles(
						"furniture",
						photos.map((p) => p.file),
					);
					if (!uploaded.ok) {
						toast.error(uploaded.message);
						return;
					}
					uploadedUrls = uploaded.urls;
				}
				const result = await saveFurnitureTypeAction({
					id: null,
					name,
					categoryId: category.id,
					description: values.description,
					buildNotes: values.buildNotes,
					leadTime: values.leadTime,
					standardSize: values.standardSize,
					cratePieces: Math.max(1, Math.round(Number(values.cratePieces) || 1)),
					status,
					photos: uploadedUrls,
					parts,
					labour: [],
					machines: [],
					extras: [],
				});
				if (!result.ok) {
					toast.error(result.message);
					return;
				}
				toast.success(
					status === "draft"
						? `${name} saved as a draft. Only template editors can see it.`
						: `${name} is published. Customer care and sales can add it to quotes now.`,
				);
				router.push("/furniture-types");
			});
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
						<Button disabled={saving || !category} onClick={submit("draft")}>
							Save draft
						</Button>
						<Button
							variant="primary"
							disabled={saving || !category || parts.length === 0 || !hasName}
							title={
								parts.length === 0
									? "Add at least one part to publish"
									: !hasName
										? "Give the type a name to publish"
										: undefined
							}
							onClick={submit("published")}
						>
							{saving ? "Saving…" : "Publish type"}
						</Button>
					</>
				}
			/>

			{categories.length === 0 && (
				<div
					role="status"
					className="flex flex-wrap items-center gap-3 rounded-md border border-warning-line bg-warning-subtle px-4 py-3 text-body text-fg"
				>
					<span className="min-w-0 flex-1">
						Every furniture type belongs to a markup category, and there are none yet.{" "}
						{canAddCategory
							? "Add the first one to continue."
							: "Ask the MD, GM or Accounting to add one in Pricing & margins."}
					</span>
					{canAddCategory ? (
						<Button size="sm" onClick={() => setAddingCategory(true)}>
							<Plus />
							Add category
						</Button>
					) : (
						<LinkButton href="/furniture-types" size="sm">
							Back to furniture types
						</LinkButton>
					)}
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

						<div className="flex flex-wrap items-end gap-3">
							<Select
								label="Category"
								className="min-w-60 flex-1"
								value={category?.id ?? ""}
								onChange={(e) => setCategoryId(e.target.value)}
								disabled={categories.length === 0}
								hint={
									category
										? `Sets the default markup (${percent(markup)}) and margin cap (${percent(cap)}) from Pricing & margins.`
										: "No categories yet."
								}
							>
								{categories.map((c) => (
									<option key={c.id} value={c.id}>
										{c.name}
									</option>
								))}
							</Select>
							{canAddCategory && (
								<Button className="mb-7" onClick={() => setAddingCategory(true)}>
									<Plus />
									New category
								</Button>
							)}
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
									category={category?.name ?? ""}
									src={photos[0]?.previewUrl}
									size="lg"
									label={
										photos[0]
											? "Cover photo preview"
											: "Placeholder cover photo"
									}
								/>
								<input
									ref={photoInputRef}
									type="file"
									accept={IMAGE_ACCEPT}
									multiple
									className="hidden"
									onChange={(e) => {
										pickPhotos(e.target.files);
										e.target.value = "";
									}}
								/>
								<Button
									disabled={saving || photos.length >= MAX_PHOTOS_PER_UPLOAD}
									title={
										photos.length >= MAX_PHOTOS_PER_UPLOAD
											? `Maximum ${MAX_PHOTOS_PER_UPLOAD} photos`
											: undefined
									}
									onClick={() => photoInputRef.current?.click()}
								>
									<Plus />
									Add photos
								</Button>
							</div>
							{photos.length > 0 && (
								<ul className="flex flex-wrap gap-2" aria-label="Selected photos">
									{photos.map((p, index) => (
										<li key={p.previewUrl} className="relative">
											<TypePhoto
												category={category?.name ?? ""}
												src={p.previewUrl}
												size="sm"
												label={
													index === 0
														? "Cover photo"
														: `Photo ${index + 1}`
												}
											/>
											{index === 0 && (
												<span className="pointer-events-none absolute inset-x-0 bottom-0 rounded-b-md bg-inverse/75 text-center text-[10px] leading-tight text-fg-inverse">
													Cover
												</span>
											)}
											<button
												type="button"
												aria-label={`Remove ${index === 0 ? "cover photo" : `photo ${index + 1}`}`}
												title="Remove photo"
												onClick={() => removePhoto(p.previewUrl)}
												className="absolute -top-1.5 -right-1.5 grid size-5 cursor-pointer place-items-center rounded-full border border-line bg-surface text-fg-secondary shadow-xs hover:bg-danger-subtle hover:text-danger-fg"
											>
												<X className="size-3" aria-hidden="true" />
											</button>
										</li>
									))}
								</ul>
							)}
							<small className="text-small text-fg-tertiary">
								Up to {MAX_PHOTOS_PER_UPLOAD}. The first is the cover, shown when
								picking items on a quote, on job cards and in Furniture types.
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
											{inventory.length === 0
												? "Inventory is empty."
												: "No inventory parts match."}
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
													{[p.sku, p.spec, `${p.available} available`]
														.filter(Boolean)
														.join(" · ")}
												</span>
											</span>
											{showCost && (
												<span className="text-small text-fg-secondary tabular">
													{formatNaira(p.unitCost)}
												</span>
											)}
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
										{showCost && (
											<>
												<th scope="col" className="text-end">
													Unit cost
												</th>
												<th scope="col" className="text-end">
													Line cost
												</th>
											</>
										)}
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
												{showCost && (
													<>
														<td className="text-end tabular">
															{formatNaira(item.unitCost)}
														</td>
														<td className="text-end font-bold text-fg tabular">
															{formatNaira(item.unitCost * p.qty)}
														</td>
													</>
												)}
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
					{showCost && (
						<Card className="gap-3" aria-labelledby="price-title">
							<h2 id="price-title">Cost and price per piece</h2>
							<dl className="flex flex-col gap-3 text-body">
								<div className="flex justify-between gap-3">
									<dt className="text-fg-secondary">Parts cost</dt>
									<dd className="tabular">{formatNaira(cost.parts)}</dd>
								</div>
								<div className="flex justify-between gap-3">
									<dt className="text-fg-secondary">
										Markup ({percent(markup)})
									</dt>
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
								Labour, machine time and other costs are added on the type&apos;s
								page once it&apos;s saved; contingency ({percent(rates.contingency)}
								) is added there too. Customer care can raise the markup on a quote
								up to the {percent(cap)} cap. Trade discounts apply on top.
							</p>
						</Card>
					)}

					<Card className="gap-3" aria-labelledby="who-title">
						<h2 id="who-title">Who can see it</h2>
						<dl className="flex flex-col gap-2 text-body">
							<Who label="Customer care, sales" value="Quote it, see costs" />
							<Who label="Production" value="Add, edit and delete, no costs" />
							<Who label="Procurement" value="Add and edit, with costs" />
							<Who label="Accounting" value="Everything, view only" />
							<Who label="MD/GM" value="Everything" />
						</dl>
					</Card>
				</aside>
			</div>

			{addingCategory && (
				<AddCategoryDrawer
					onClose={() => setAddingCategory(false)}
					onAdded={(added) => {
						setCategoryId(added.id);
						setAddingCategory(false);
					}}
				/>
			)}
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
