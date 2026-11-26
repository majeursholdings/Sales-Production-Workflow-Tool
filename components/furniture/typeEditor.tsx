"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import Link from "next/link";
import { ChevronDown, Plus, Trash2, X } from "lucide-react";
import { Badge } from "@/components/common/badge";
import { toast } from "sonner";
import { Button, buttonClasses } from "@/components/common/buttons";
import { Card, CardHeader, CardTitle } from "@/components/common/card";
import { ConfirmDialog } from "@/components/common/modal";
import { IMAGE_ACCEPT } from "@/components/forms/fileRules";
import { Input, Select, Textarea } from "@/components/forms/input";
import { IconButton, Table } from "@/components/tables";
import { Menu, MenuItem } from "@/components/tables/menu";
import { formatNaira } from "@/lib/currency";
import {
	MAX_PHOTOS_PER_UPLOAD,
	MAX_PHOTO_BYTES,
	resolvePhotoType,
} from "@/lib/storage";
import { uploadStorageFiles } from "@/lib/storageClient";
import {
	deleteFurnitureTypeAction,
	saveFurnitureTypeAction,
} from "@/app/(dashboard)/furniture-types/actions";
import {
	costTemplate,
	percent,
	type CostingRates,
	type ExtraCost,
	type FurnitureAccess,
	type FurnitureCategory,
	type FurnitureTemplate,
	type FurnitureTypeStatus,
	type FurnitureTypeSummary,
	type HoursRow,
	type InventoryPart,
	type OtherCostOption,
	type TemplatePart,
} from "@/lib/furnitureTypes";
import AddHoursDrawer, { type HoursKind } from "./addHoursDrawer";
import AddOtherCostDrawer from "./addOtherCostDrawer";
import AddPartDrawer from "./addPartDrawer";
import ChangeCoverDrawer from "./changeCoverDrawer";
import CostBreakdown from "./costBreakdown";
import QtyStepper from "./qtyStepper";
import TypePhoto from "./typePhoto";

type Draft = {
	parts: TemplatePart[];
	labour: HoursRow[];
	machines: HoursRow[];
	extras: ExtraCost[];
	/** Photo URLs, cover first. */
	photos: string[];
};

type Details = {
	name: string;
	categoryId: string;
	description: string;
	buildNotes: string;
};

const startOf = (t: FurnitureTemplate): Draft => ({
	parts: t.parts,
	labour: t.labour,
	machines: t.machines,
	extras: t.extras,
	photos: t.photos,
});

const photoLabel = (index: number) => (index === 0 ? "Cover photo" : `Photo ${index + 1}`);

/**
 * One furniture type's template: details, standard parts, hours and costs, and build notes.
 * What a person can change, and whether they see costs, follows their role (`access`).
 * Mount it with `key={type.id}` so each type starts from its own saved template.
 */
export default function TypeEditor({
	type,
	template,
	categories,
	inventory,
	rates,
	otherCosts,
	access,
	onDeleted,
}: {
	type: FurnitureTypeSummary;
	template: FurnitureTemplate;
	categories: FurnitureCategory[];
	inventory: InventoryPart[];
	rates: CostingRates;
	/** Standard costs from Cost rates that can be added per piece. */
	otherCosts: OtherCostOption[];
	access: FurnitureAccess;
	onDeleted: () => void;
}) {
	const { canEditDetails, canEditParts, showCost } = access;
	// Edits stay local until saved; the saved template comes back from the server as `template`.
	const [draft, setDraft] = useState<Draft>(() => startOf(template));
	const [pendingFiles, setPendingFiles] = useState<Map<string, File>>(() => new Map());
	const pendingRef = useRef(pendingFiles);
	const photoInputRef = useRef<HTMLInputElement>(null);
	const [removing, setRemoving] = useState<string | null>(null);
	const [deleting, setDeleting] = useState(false);
	const [drawer, setDrawer] = useState<"part" | "other" | "cover" | HoursKind | null>(null);
	const [saving, startSaving] = useTransition();

	useEffect(() => {
		pendingRef.current = pendingFiles;
	}, [pendingFiles]);

	useEffect(
		() => () => {
			for (const url of pendingRef.current.keys()) URL.revokeObjectURL(url);
		},
		[],
	);

	const pickPhotos = (files: FileList | null) => {
		if (!files?.length) return;
		const remaining = MAX_PHOTOS_PER_UPLOAD - draft.photos.length;
		if (remaining <= 0) {
			toast.error(`You can attach up to ${MAX_PHOTOS_PER_UPLOAD} photos.`);
			return;
		}
		const addedUrls: string[] = [];
		const nextPending = new Map(pendingFiles);
		for (const file of Array.from(files).slice(0, remaining)) {
			if (file.size > MAX_PHOTO_BYTES) {
				toast.error(`${file.name} is larger than 10 MB.`);
				continue;
			}
			if (!resolvePhotoType(file)) {
				toast.error(`${file.name} isn't a supported image.`);
				continue;
			}
			const previewUrl = URL.createObjectURL(file);
			addedUrls.push(previewUrl);
			nextPending.set(previewUrl, file);
		}
		if (files.length > remaining) {
			toast.info(`Kept the first ${remaining} photo${remaining === 1 ? "" : "s"} (max ${MAX_PHOTOS_PER_UPLOAD}).`);
		}
		if (addedUrls.length > 0) {
			setPendingFiles(nextPending);
			setDraft((d) => ({ ...d, photos: [...d.photos, ...addedUrls] }));
		}
	};

	const removePhoto = (url: string) => {
		if (pendingFiles.has(url)) {
			URL.revokeObjectURL(url);
			const next = new Map(pendingFiles);
			next.delete(url);
			setPendingFiles(next);
		}
		setDraft((d) => ({ ...d, photos: d.photos.filter((p) => p !== url) }));
	};

	const form = useForm<Details>({
		defaultValues: {
			name: type.name,
			categoryId: type.categoryId,
			description: template.description,
			buildNotes: template.buildNotes,
		},
	});
	const categoryId = useWatch({ control: form.control, name: "categoryId" }) ?? type.categoryId;
	const name = useWatch({ control: form.control, name: "name" }) ?? type.name;
	const description = useWatch({ control: form.control, name: "description" }) ?? "";
	const category = categories.find((c) => c.id === categoryId);
	const categoryName = category?.name ?? type.category;
	const markupRate = category?.markup ?? 0;
	const cap = category?.cap ?? 0;

	const bySku = new Map(inventory.map((p) => [p.sku, p]));
	const cost = costTemplate(draft, inventory, markupRate, rates);
	const dirty =
		form.formState.isDirty || JSON.stringify(draft) !== JSON.stringify(startOf(template));

	const setPartQty = (sku: string, qty: number) =>
		setDraft((d) => ({ ...d, parts: d.parts.map((p) => (p.sku === sku ? { ...p, qty } : p)) }));
	const setHours = (key: "labour" | "machines", rowName: string, hours: number) =>
		setDraft((d) => ({
			...d,
			[key]: d[key].map((r) => (r.name === rowName ? { ...r, hours } : r)),
		}));

	const save = (status: FurnitureTypeStatus) =>
		form.handleSubmit((values) =>
			startSaving(async () => {
				const label = values.name.trim() || type.name;
				let finalPhotos = draft.photos;
				const queuedEntries = draft.photos
					.map((url, index) => ({ url, index, file: pendingFiles.get(url) }))
					.filter((entry): entry is { url: string; index: number; file: File } => !!entry.file);

				if (queuedEntries.length > 0) {
					const uploaded = await uploadStorageFiles(
						"furniture",
						queuedEntries.map((e) => e.file),
					);
					if (!uploaded.ok) {
						toast.error(uploaded.message);
						return;
					}
					const replacements = new Map(
						queuedEntries.map((entry, i) => [entry.url, uploaded.urls[i]]),
					);
					finalPhotos = draft.photos.map((url) => replacements.get(url) ?? url);
				}

				const result = await saveFurnitureTypeAction({
					id: type.id,
					name: label,
					categoryId: values.categoryId,
					description: values.description,
					buildNotes: values.buildNotes,
					leadTime: template.leadTime,
					standardSize: template.standardSize,
					cratePieces: template.cratePieces,
					status,
					photos: finalPhotos,
					parts: draft.parts,
					labour: draft.labour.map(({ name, hours }) => ({ name, hours })),
					machines: draft.machines.map(({ name, hours }) => ({ name, hours })),
					extras: draft.extras,
				});
				if (!result.ok) {
					toast.error(result.message);
					return;
				}
				for (const url of pendingFiles.keys()) URL.revokeObjectURL(url);
				setPendingFiles(new Map());
				setDraft((d) => ({ ...d, photos: finalPhotos }));
				form.reset(values);
				toast.success(
					status === "published" && type.status === "draft"
						? `${label} is published. Sales and customer care can quote it now.`
						: `${label} template saved. ${
								showCost
									? "New quotes use it from now on."
									: "Costs are checked by the MD/GM before quoting."
							}`,
				);
			}),
		)();

	const discard = () => {
		for (const url of pendingFiles.keys()) URL.revokeObjectURL(url);
		setPendingFiles(new Map());
		setDraft(startOf(template));
		form.reset();
	};

	const remove = () =>
		startSaving(async () => {
			const result = await deleteFurnitureTypeAction(type.id);
			setDeleting(false);
			if (!result.ok) {
				toast.error(result.message);
				return;
			}
			toast.success(`${type.name} deleted.`);
			onDeleted();
		});

	const removingPart = removing ? bySku.get(removing) : undefined;

	return (
		<div className="flex min-w-0 flex-1 basis-140 flex-col gap-4">
			<Card className="gap-4" aria-label="Furniture type details">
				<div className="flex flex-wrap items-center gap-4">
					<TypePhoto
						category={categoryName}
						src={draft.photos[0]}
						size="lg"
						label={`Cover photo: ${name}`}
					/>
					<div className="flex min-w-0 flex-1 basis-52 flex-col gap-2">
						{type.status === "draft" && (
							<Badge variant="warning" className="self-start">
								Draft: not on quotes yet
							</Badge>
						)}
						<span className="text-small text-fg-tertiary">
							{draft.photos.length === 0
								? "No photos yet"
								: `${draft.photos.length} ${draft.photos.length === 1 ? "photo" : "photos"}`}{" "}
							· the cover is shown on quotes, job cards and here
						</span>
						{canEditDetails && (
							<div className="flex flex-wrap gap-2">
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
									size="sm"
									disabled={saving || draft.photos.length >= MAX_PHOTOS_PER_UPLOAD}
									title={
										draft.photos.length >= MAX_PHOTOS_PER_UPLOAD
											? `Maximum ${MAX_PHOTOS_PER_UPLOAD} photos`
											: undefined
									}
									onClick={() => photoInputRef.current?.click()}
								>
									<Plus />
									Add photos
								</Button>
								<Button
									size="sm"
									variant="ghost"
									disabled={draft.photos.length < 2}
									title={
										draft.photos.length < 2
											? "Needs at least two photos"
											: undefined
									}
									onClick={() => setDrawer("cover")}
								>
									Change cover
								</Button>
							</div>
						)}
					</div>
				</div>

				{draft.photos.length > 0 && (
					<ul className="flex flex-wrap gap-2" aria-label="Furniture type photos">
						{draft.photos.map((src, index) => (
							<li key={src} className="relative">
								<TypePhoto
									category={categoryName}
									src={src}
									size="sm"
									label={photoLabel(index)}
								/>
								{index === 0 && (
									<span className="pointer-events-none absolute inset-x-0 bottom-0 rounded-b-md bg-inverse/75 text-center text-[10px] leading-tight text-fg-inverse">
										Cover
									</span>
								)}
								{canEditDetails && (
									<button
										type="button"
										aria-label={`Remove ${photoLabel(index).toLowerCase()}`}
										title="Remove photo"
										onClick={() => removePhoto(src)}
										className="absolute -top-1.5 -right-1.5 grid size-5 cursor-pointer place-items-center rounded-full border border-line bg-surface text-fg-secondary shadow-xs hover:bg-danger-subtle hover:text-danger-fg"
									>
										<X className="size-3" aria-hidden="true" />
									</button>
								)}
							</li>
						))}
					</ul>
				)}

				{canEditDetails ? (
					<>
						<div className="grid gap-4 sm:grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
							<Input label="Name" {...form.register("name", { required: true })} />
							<Select
								label="Category"
								hint="Sets the markup and ceiling from Pricing & margins."
								{...form.register("categoryId")}
							>
								{categories.map((c) => (
									<option key={c.id} value={c.id}>
										{c.name}
									</option>
								))}
							</Select>
						</div>
						<Input label="Description on quotes" {...form.register("description")} />
					</>
				) : (
					<div className="flex flex-col gap-1">
						<span className="text-overline font-bold tracking-[0.06em] text-fg-secondary uppercase">
							{categoryName}
						</span>
						<h2 className="text-h2">{type.name}</h2>
						<p className="text-body text-fg-secondary">{description}</p>
					</div>
				)}
			</Card>

			<Card flush className="overflow-hidden" aria-labelledby="parts-title">
				<CardHeader>
					<CardTitle id="parts-title" className="flex-1">
						Standard parts
					</CardTitle>
					<span className="text-small text-fg-tertiary">
						{draft.parts.length} parts per piece
					</span>
					{canEditParts && (
						<Button size="sm" onClick={() => setDrawer("part")}>
							<Plus />
							Add part
						</Button>
					)}
				</CardHeader>
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
							{canEditParts && (
								<th scope="col" className="w-10">
									<span className="sr-only">Remove</span>
								</th>
							)}
						</tr>
					</thead>
					<tbody>
						{draft.parts.map((p) => {
							const item = bySku.get(p.sku);
							if (!item) return null;
							return (
								<tr key={p.sku}>
									<td>
										<span className="flex flex-col">
											<span className="font-bold text-fg">{item.name}</span>
											<span className="text-small text-fg-tertiary">
												{p.sku}
											</span>
										</span>
									</td>
									<td>{item.spec}</td>
									<td>
										{canEditParts ? (
											<QtyStepper
												value={p.qty}
												onChange={(qty) => setPartQty(p.sku, qty)}
												decLabel={`Fewer ${item.name}`}
												incLabel={`More ${item.name}`}
												unit={`${item.unit}s`}
											/>
										) : (
											<span>
												<strong className="text-fg">{p.qty}</strong>{" "}
												<span className="text-small text-fg-tertiary">
													{item.unit}s
												</span>
											</span>
										)}
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
									{canEditParts && (
										<td>
											<IconButton
												danger
												aria-label={`Remove ${item.name}`}
												title="Remove part"
												onClick={() => setRemoving(p.sku)}
											>
												<Trash2 aria-hidden="true" />
											</IconButton>
										</td>
									)}
								</tr>
							);
						})}
					</tbody>
				</Table>
				{draft.parts.length === 0 && (
					<p className="px-5 py-6 text-center text-body text-fg-secondary">
						No parts yet. Add the first one from inventory.
					</p>
				)}
				{showCost && (
					<div className="flex justify-end border-t border-line px-5 py-4">
						<div className="flex w-80 max-w-full justify-between gap-3 font-bold">
							<span>Parts cost per piece</span>
							<span className="tabular">{formatNaira(cost.parts)}</span>
						</div>
					</div>
				)}
			</Card>

			<Card flush className="overflow-hidden" aria-labelledby="costs-title">
				<CardHeader>
					<CardTitle id="costs-title" className="flex-1">
						Labour, machines and other costs
					</CardTitle>
					<span className="text-small text-fg-tertiary">
						{cost.labourHours} production hours, {cost.machineHours} machine hours per
						piece
					</span>
					{canEditParts && (
						<Menu
							label="Add to this furniture type"
							triggerClassName={buttonClasses({ size: "sm" })}
							trigger={
								<>
									<Plus aria-hidden="true" />
									Add
									<ChevronDown aria-hidden="true" />
								</>
							}
						>
							<MenuItem onSelect={() => setDrawer("labour")}>Labour hours</MenuItem>
							<MenuItem onSelect={() => setDrawer("machine")}>Machine time</MenuItem>
							{canEditDetails && showCost && (
								<MenuItem onSelect={() => setDrawer("other")}>Other cost</MenuItem>
							)}
						</Menu>
					)}
				</CardHeader>

				<HoursTable
					heading="Labour by position"
					unitLabel="Position"
					rows={draft.labour}
					showCost={showCost}
					canEdit={canEditParts}
					onChange={(n, h) => setHours("labour", n, h)}
				/>
				<HoursTable
					heading="Machine time"
					unitLabel="Machine"
					rows={draft.machines}
					showCost={showCost}
					canEdit={canEditParts}
					onChange={(n, h) => setHours("machines", n, h)}
				/>

				{showCost && (
					<div className="flex flex-wrap gap-6 border-t border-line px-5 py-4">
						<div className="flex min-w-60 flex-1 basis-60 flex-col gap-2">
							<span className="text-overline font-bold tracking-[0.06em] text-fg-secondary uppercase">
								Other costs per piece
							</span>
							{draft.extras.length === 0 ? (
								<p className="text-small text-fg-tertiary">
									No other costs per piece.
								</p>
							) : (
								<ul className="flex flex-col">
									{draft.extras.map((x) => (
										<li key={x.name} className="flex items-center gap-3 py-2">
											<span className="flex min-w-0 flex-1 flex-col">
												<span>{x.name}</span>
												<span className="text-small text-fg-tertiary">
													{x.type} · per piece
												</span>
											</span>
											<strong className="tabular">
												{formatNaira(x.amount)}
											</strong>
											{canEditDetails && (
												<IconButton
													danger
													aria-label={`Remove ${x.name}`}
													title="Remove"
													onClick={() =>
														setDraft((d) => ({
															...d,
															extras: d.extras.filter(
																(e) => e.name !== x.name,
															),
														}))
													}
												>
													<Trash2 aria-hidden="true" />
												</IconButton>
											)}
										</li>
									))}
								</ul>
							)}
							<p className="text-small text-fg-tertiary">
								Project costs like delivery, installation and third-party work are
								added on each quote.
							</p>
						</div>
						<div className="flex flex-1 basis-80 flex-col gap-2">
							<CostBreakdown
								cost={cost}
								category={categoryName}
								markupRate={markupRate}
								rates={rates}
							/>
							<p className="text-small text-fg-tertiary">
								Customer care can raise the markup on a quote up to the{" "}
								{percent(cap)} cap. Rates come from{" "}
								<Link href="/cost-rates">Cost rates</Link>, set by Accounting.
							</p>
						</div>
					</div>
				)}
			</Card>

			<Card aria-labelledby="notes-title">
				<h2 id="notes-title">Build notes</h2>
				{canEditParts ? (
					<Textarea
						label="Build notes"
						className="[&>label]:sr-only"
						hint="Printed on every job card made from this type."
						{...form.register("buildNotes")}
					/>
				) : (
					<ul className="flex list-disc flex-col gap-1 ps-5 text-body text-fg-secondary">
						{template.buildNotes.trim() === "" && (
							<li className="list-none text-fg-tertiary">No build notes yet.</li>
						)}
						{template.buildNotes
							.split(/(?<=\.)\s+/)
							.filter(Boolean)
							.map((line) => (
								<li key={line}>{line}</li>
							))}
					</ul>
				)}
			</Card>

			{canEditParts && (
				<div className="flex flex-wrap items-center justify-end gap-3">
					{canEditDetails && (
						<Button
							variant="ghost"
							className="me-auto hover:bg-danger-subtle hover:text-danger-fg"
							disabled={saving}
							onClick={() => setDeleting(true)}
						>
							<Trash2 />
							Delete type
						</Button>
					)}
					<span className="text-small text-fg-tertiary">
						Changes apply to new quotes and job cards only.{" "}
						{dirty && "You have unsaved changes."}
					</span>
					<Button disabled={!dirty || saving} onClick={discard}>
						Discard
					</Button>
					{type.status === "draft" && canEditDetails ? (
						<>
							<Button disabled={!dirty || saving} onClick={() => save("draft")}>
								Save draft
							</Button>
							<Button
								variant="primary"
								disabled={saving || draft.parts.length === 0}
								title={
									draft.parts.length === 0
										? "Add at least one part to publish"
										: undefined
								}
								onClick={() => save("published")}
							>
								{saving ? "Saving…" : "Publish type"}
							</Button>
						</>
					) : (
						<Button
							variant="primary"
							disabled={!dirty || saving}
							onClick={() => save(type.status)}
						>
							{saving ? "Saving…" : "Save template"}
						</Button>
					)}
				</div>
			)}

			{drawer === "cover" && (
				<ChangeCoverDrawer
					typeName={name}
					category={categoryName}
					photos={draft.photos}
					onClose={() => setDrawer(null)}
					onChoose={(index) => {
						setDraft((d) => ({
							...d,
							photos: [d.photos[index], ...d.photos.filter((_, i) => i !== index)],
						}));
						setDrawer(null);
						toast.success(
							`${photoLabel(index)} is now the cover. Save the template to keep it.`,
						);
					}}
				/>
			)}
			{drawer === "part" && (
				<AddPartDrawer
					typeName={name}
					inventory={inventory}
					inTemplate={draft.parts.map((p) => p.sku)}
					showCost={showCost}
					onClose={() => setDrawer(null)}
					onAdd={(sku, qty) => {
						setDraft((d) => ({ ...d, parts: [...d.parts, { sku, qty }] }));
						setDrawer(null);
					}}
				/>
			)}
			{(drawer === "labour" || drawer === "machine") && (
				<AddHoursDrawer
					kind={drawer}
					typeName={name}
					rates={drawer === "labour" ? rates.labourRates : rates.machineRates}
					overheadPerLabourHour={rates.overheadPerLabourHour}
					existing={drawer === "labour" ? draft.labour : draft.machines}
					showCost={showCost}
					onClose={() => setDrawer(null)}
					onAdd={(row) => {
						setDraft((d) =>
							drawer === "labour"
								? { ...d, labour: [...d.labour, row] }
								: { ...d, machines: [...d.machines, row] },
						);
						setDrawer(null);
						toast.success(`${row.name} added: ${row.hours} hours per piece.`);
					}}
				/>
			)}
			{drawer === "other" && (
				<AddOtherCostDrawer
					typeName={name}
					options={otherCosts}
					existing={draft.extras}
					onClose={() => setDrawer(null)}
					onAdd={(extra) => {
						setDraft((d) => ({ ...d, extras: [...d.extras, extra] }));
						setDrawer(null);
						toast.success(`${extra.name} added to the cost of each piece.`);
					}}
				/>
			)}
			{removing && removingPart && (
				<ConfirmDialog
					title={`Remove ${removingPart.name}?`}
					confirmLabel="Remove part"
					onCancel={() => setRemoving(null)}
					onConfirm={() => {
						setDraft((d) => ({
							...d,
							parts: d.parts.filter((p) => p.sku !== removing),
						}));
						setRemoving(null);
					}}
				>
					It comes off this template. You can add it back from inventory.
				</ConfirmDialog>
			)}
			{deleting && (
				<ConfirmDialog
					title={`Delete ${type.name}?`}
					confirmLabel="Delete type"
					onCancel={() => setDeleting(false)}
					onConfirm={remove}
				>
					It comes off Furniture types and can&apos;t be added to new quotes. Quotes
					already sent keep their prices.
				</ConfirmDialog>
			)}
		</div>
	);
}

function HoursTable({
	heading,
	unitLabel,
	rows,
	showCost,
	canEdit,
	onChange,
}: {
	heading: string;
	unitLabel: string;
	rows: HoursRow[];
	showCost: boolean;
	canEdit: boolean;
	onChange: (name: string, hours: number) => void;
}) {
	return (
		<Table className="min-w-140">
			<thead>
				<tr>
					<th scope="col">{heading}</th>
					<th scope="col">Hours per piece</th>
					{showCost && (
						<>
							<th scope="col" className="text-end">
								Rate
							</th>
							<th scope="col" className="text-end">
								Cost
							</th>
						</>
					)}
				</tr>
			</thead>
			<tbody>
				{rows.map((r) => (
					<tr key={r.name}>
						<td className="font-bold text-fg">
							<span className="sr-only">{unitLabel}: </span>
							{r.name}
						</td>
						<td>
							{canEdit ? (
								<QtyStepper
									value={r.hours}
									min={0}
									onChange={(h) => onChange(r.name, h)}
									decLabel={`Fewer ${r.name.toLowerCase()} hours`}
									incLabel={`More ${r.name.toLowerCase()} hours`}
									unit="hours"
								/>
							) : (
								<span>
									<strong className="text-fg">{r.hours}</strong>{" "}
									<span className="text-small text-fg-tertiary">hours</span>
								</span>
							)}
						</td>
						{showCost && (
							<>
								<td className="text-end tabular">
									{formatNaira(r.rate).replace(".00", "")}/h
								</td>
								<td className="text-end font-bold text-fg tabular">
									{formatNaira(r.hours * r.rate)}
								</td>
							</>
						)}
					</tr>
				))}
			</tbody>
		</Table>
	);
}
