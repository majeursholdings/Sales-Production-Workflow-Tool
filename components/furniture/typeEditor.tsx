"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import Link from "next/link";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonClasses } from "@/components/common/buttons";
import { Card, CardHeader, CardTitle } from "@/components/common/card";
import { ConfirmDialog } from "@/components/common/modal";
import { Input, Select, Textarea } from "@/components/forms/input";
import { IconButton, Table } from "@/components/tables";
import { Menu, MenuItem } from "@/components/tables/menu";
import { formatNaira } from "@/lib/currency";
import {
	CATEGORY_MARKUP,
	FURNITURE_CATEGORIES,
	LABOUR_RATES,
	MACHINE_RATES,
	costTemplate,
	percent,
	type ExtraCost,
	type FurnitureAccess,
	type FurnitureCategory,
	type FurnitureTemplate,
	type FurnitureTypeSummary,
	type HoursRow,
	type InventoryPart,
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
	/** Photo captions, cover first. */
	photos: string[];
};

type Details = {
	name: string;
	category: FurnitureCategory;
	description: string;
	buildNotes: string;
};

// Stand-in captions until photo upload is connected
const PHOTO_CAPTIONS = [
	"Front view",
	"Side view",
	"Detail close-up",
	"Back view",
	"Frame detail",
	"In a room",
];

const startOf = (t: FurnitureTemplate): Draft => ({
	parts: t.parts,
	labour: t.labour,
	machines: t.machines,
	extras: t.extras,
	photos: PHOTO_CAPTIONS.slice(0, t.photoCount),
});

/**
 * One furniture type's template: details, standard parts, hours and costs, and build notes.
 * What a person can change, and whether they see costs, follows their role (`access`).
 * Mount it with `key={type.id}` so each type starts from its own saved template.
 */
export default function TypeEditor({
	type,
	template,
	inventory,
	access,
	onSaved,
}: {
	type: FurnitureTypeSummary;
	template: FurnitureTemplate;
	inventory: InventoryPart[];
	access: FurnitureAccess;
	/** Tells the page the saved name, category and parts count, so the list stays in step. */
	onSaved: (summary: FurnitureTypeSummary, partCount: number) => void;
}) {
	const { canEditDetails, canEditParts, showCost } = access;
	// TODO: save through the backend once it exists; for now it only changes this page.
	const [draft, setDraft] = useState<Draft>(() => startOf(template));
	const [saved, setSaved] = useState<Draft>(() => startOf(template));
	const [removing, setRemoving] = useState<string | null>(null);
	const [drawer, setDrawer] = useState<"part" | "other" | "cover" | HoursKind | null>(null);

	const form = useForm<Details>({
		defaultValues: {
			name: type.name,
			category: type.category,
			description: template.description,
			buildNotes: template.buildNotes,
		},
	});
	const category = useWatch({ control: form.control, name: "category" }) ?? type.category;
	const name = useWatch({ control: form.control, name: "name" }) ?? type.name;
	const description = useWatch({ control: form.control, name: "description" }) ?? "";
	const { markup: markupRate, cap } = CATEGORY_MARKUP[category];

	const bySku = new Map(inventory.map((p) => [p.sku, p]));
	const cost = costTemplate(draft, inventory, markupRate);
	const dirty = form.formState.isDirty || JSON.stringify(draft) !== JSON.stringify(saved);

	const setPartQty = (sku: string, qty: number) =>
		setDraft((d) => ({ ...d, parts: d.parts.map((p) => (p.sku === sku ? { ...p, qty } : p)) }));
	const setHours = (key: "labour" | "machines", rowName: string, hours: number) =>
		setDraft((d) => ({
			...d,
			[key]: d[key].map((r) => (r.name === rowName ? { ...r, hours } : r)),
		}));

	const save = form.handleSubmit((values) => {
		setSaved(draft);
		form.reset(values);
		onSaved(
			{ id: type.id, name: values.name.trim() || type.name, category: values.category },
			draft.parts.length,
		);
		toast.success(
			`${values.name.trim() || type.name} template saved. ${
				showCost
					? "New quotes use it from now on."
					: "Procurement and Accounting were notified so costs can be checked."
			}`,
		);
	});

	const discard = () => {
		setDraft(saved);
		form.reset();
	};

	const removingPart = removing ? bySku.get(removing) : undefined;

	return (
		<div className="flex min-w-0 flex-1 basis-140 flex-col gap-4">
			<Card className="gap-4" aria-label="Furniture type details">
				<div className="flex flex-wrap items-center gap-4">
					<TypePhoto
						category={category}
						size="lg"
						label={`Cover photo: ${name}, ${draft.photos[0] ?? "placeholder"}`}
					/>
					<div className="flex min-w-0 flex-1 basis-52 flex-col gap-2">
						<span className="text-small text-fg-tertiary">
							Cover photo: {draft.photos[0]} · {draft.photos.length} photos · shown on
							quotes, job cards and here
						</span>
						{canEditDetails && (
							<div className="flex flex-wrap gap-2">
								<Button size="sm" disabled title="Photo upload isn't connected yet">
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

				{canEditDetails ? (
					<>
						<div className="grid gap-4 sm:grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
							<Input label="Name" {...form.register("name", { required: true })} />
							<Select
								label="Category"
								hint="Sets the markup and ceiling from Pricing & margins."
								{...form.register("category")}
							>
								{FURNITURE_CATEGORIES.map((c) => (
									<option key={c} value={c}>
										{c}
									</option>
								))}
							</Select>
						</div>
						<Input label="Description on quotes" {...form.register("description")} />
					</>
				) : (
					<div className="flex flex-col gap-1">
						<span className="text-overline font-bold tracking-[0.06em] text-fg-secondary uppercase">
							{type.category}
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
								category={category}
								markupRate={markupRate}
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
					<span className="text-small text-fg-tertiary">
						Changes apply to new quotes and job cards only.{" "}
						{dirty && "You have unsaved changes."}
					</span>
					<Button disabled={!dirty} onClick={discard}>
						Discard
					</Button>
					<Button variant="primary" disabled={!dirty} onClick={save}>
						Save template
					</Button>
				</div>
			)}

			{drawer === "cover" && (
				<ChangeCoverDrawer
					typeName={name}
					category={category}
					photos={draft.photos}
					onClose={() => setDrawer(null)}
					onChoose={(index) => {
						setDraft((d) => ({
							...d,
							photos: [d.photos[index], ...d.photos.filter((_, i) => i !== index)],
						}));
						setDrawer(null);
						toast.success(
							`${draft.photos[index]} is now the cover. Save the template to keep it.`,
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
					rates={drawer === "labour" ? LABOUR_RATES : MACHINE_RATES}
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
