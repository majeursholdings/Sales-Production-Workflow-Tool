"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/common/badge";
import type { FormFieldConfig } from "@/components/forms/types";
import MaterialThumb from "@/components/suppliers/materialThumb";
import { DataTable, type ColumnDef } from "@/components/tables";
import { cn } from "@/lib/cn";
import {
	CONFIDENCE_THRESHOLD,
	firstName,
	fixKey,
	naira,
	type CostRequest,
	type PartRow,
} from "@/lib/costRequests";
import { PART_CATEGORIES, PART_UNITS } from "@/lib/inventory";
import type { SupplierCatalog } from "@/lib/suppliers";
import { toneClass } from "./requestPhoto";

/** Renders one field of the page's fix form (see costRequestsPageContent). */
export type RenderField = (config: FormFieldConfig) => ReactNode;

type Row = PartRow & { id: string };

/** How sure the agent is, as a bar with the threshold marked. */
function Confidence({ value }: { value: number }) {
	const low = value < CONFIDENCE_THRESHOLD;
	return (
		<span className="inline-flex items-center gap-2">
			<span aria-hidden="true" className="relative h-1.5 w-14 shrink-0 rounded-full bg-line">
				<span
					className={cn(
						"absolute inset-y-0 inset-s-0 rounded-full",
						low ? "bg-warning-fg" : "bg-success-fg",
					)}
					style={{ width: `${value}%` }}
				/>
				<span
					className="absolute -top-0.75 h-3 w-px bg-fg-secondary"
					style={{ insetInlineStart: `${CONFIDENCE_THRESHOLD}%` }}
				/>
			</span>
			<span
				className={cn(
					"text-small",
					low ? "font-bold text-warning-fg" : "text-fg-secondary",
				)}
			>
				{value}% sure
			</span>
		</span>
	);
}

/** The table's columns. `focus` is the part highlighted on the photo; `onFocus` changes it. */
export function partColumns(
	focus: string | null,
	onFocus: (partId: string | null) => void,
): ColumnDef<Row>[] {
	return [
		{
			key: "num",
			header: <span className="sr-only">Number on photo</span>,
			className: "w-12",
			cell: (row) => {
				const on = focus === row.part.id;
				return (
					<button
						type="button"
						aria-pressed={on}
						aria-label={
							row.part.pin
								? `Show part ${row.num} on the photo`
								: `Part ${row.num} isn't visible in the photo`
						}
						onClick={() => onFocus(on ? null : row.part.id)}
						className={cn(
							"grid size-7 cursor-pointer place-items-center rounded-full text-small font-bold",
							"focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus",
							toneClass[row.part.pin ? row.tone : row.tone || "none"],
						)}
					>
						{row.num}
					</button>
				);
			},
		},
		{
			key: "part",
			header: "Part",
			cell: (row) => (
				<span className="flex min-w-56 items-start gap-3">
					<MaterialThumb
						sku={row.sku && !row.sku.startsWith("LAB") ? row.sku : "OTHER"}
					/>
					<span className="flex min-w-0 flex-col gap-0.5">
						<strong className="text-fg">{row.name}</strong>
						<span className="text-small text-fg-tertiary">
							{[row.part.use, row.sku, row.availability].filter(Boolean).join(" · ")}
						</span>
						<span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
							<Confidence value={row.part.confidence} />
							{row.badge && <Badge variant={row.badge.tone}>{row.badge.label}</Badge>}
						</span>
					</span>
				</span>
			),
		},
		{
			key: "qty",
			header: "Qty",
			className: "text-end tabular",
			cell: (row) => <strong className="text-fg">{row.qty}</strong>,
		},
		{
			key: "unit",
			header: "Unit cost",
			className: "text-end whitespace-nowrap tabular",
			cell: (row) => (row.unitCost === null ? "—" : naira(row.unitCost)),
		},
		{
			key: "line",
			header: "Line cost",
			className: "text-end whitespace-nowrap tabular",
			cell: (row) => (
				<strong className="text-fg">
					{row.line === null ? "To be priced" : naira(row.line)}
				</strong>
			),
		},
	];
}

/** The fix for a flagged part: how to price a missing one, or whether to keep an unsure one. */
function FixRow({
	row,
	request,
	catalog,
	field,
}: {
	row: Row;
	request: CostRequest;
	catalog: SupplierCatalog;
	field: RenderField;
}) {
	const { part } = row;
	const key = (name: string) => fixKey(request.id, part.id, name);

	return (
		<div className="flex flex-col gap-4 rounded-md border border-line bg-page px-4 py-3">
			{row.missing ? (
				<>
					{field({
						name: key("fix"),
						type: "radio",
						label: `Not in inventory.${part.askedToAdd ? ` ${firstName(request.requestedBy)} asked you to add it.` : ""}`,
						options: [
							{
								value: "oneOff",
								label: "Price it and add it to inventory",
								description: part.suggestion
									? `Suggested from similar work: ${naira(part.suggestion.unitCost)} from ${catalog.suppliers.find((s) => s.id === part.suggestion?.supplierId)?.business ?? "a supplier"}.`
									: "Enter what it costs and who makes it.",
							},
							...(part.substitutes ?? []).map((s) => ({
								value: `sub:${s.id}`,
								label: `Use the agent's substitute: ${s.name} (${naira(s.qty * s.unitCost)})`,
								description: s.why,
							})),
						],
					})}
					{row.resolution?.kind === "oneOff" && (
						<>
							<div className="grid gap-4 sm:grid-cols-3">
								{field({
									name: key("cost"),
									type: "amount",
									label: "Unit cost",
									currencySymbol: "₦",
									description: "Materials and labour, before markup.",
									validation: {
										validate: (v: string) =>
											Number(v) > 0 || "Enter a cost above ₦0",
									},
								})}
								{field({
									name: key("supplier"),
									type: "select",
									label: "Supplier",
									options: catalog.suppliers.map((s) => ({
										label: s.business,
										value: s.id,
									})),
								})}
								{field({
									name: key("lead"),
									type: "text",
									label: "Lead time",
									inputMode: "numeric",
									description: "Working days",
									validation: {
										validate: (v: string) =>
											/^\d{1,3}$/.test(String(v ?? "").trim()) ||
											"Enter whole days",
									},
								})}
							</div>
							{field({
								name: key("addInv"),
								type: "checkbox",
								label: "Add to inventory so the agent can match it next time",
							})}
							{row.resolution.addToInventory && (
								<div className="grid gap-4 sm:grid-cols-2">
									{field({
										name: key("category"),
										type: "select",
										label: "Inventory category",
										placeholder: "Pick a category",
										options: PART_CATEGORIES.map((c) => ({ label: c, value: c })),
										validation: {
											validate: (v: string) =>
												!!v || "Pick a category for inventory",
										},
									})}
									{field({
										name: key("unit"),
										type: "select",
										label: "Unit",
										options: PART_UNITS.map((u) => ({ label: u, value: u })),
									})}
								</div>
							)}
						</>
					)}
				</>
			) : (
				field({
					name: key("fix"),
					type: "radio",
					label: "Is this part right?",
					description: part.doubt,
					options: [
						{ value: "keep", label: "Keep it" },
						{ value: "drop", label: "Remove it" },
					],
				})
			)}
		</div>
	);
}

/** The agent's parts list: each part with how sure it is, and a fix row under any it flagged. */
export default function PartsTable({
	request,
	rows,
	catalog,
	editable,
	focus,
	onFocus,
	field,
}: {
	request: CostRequest;
	rows: PartRow[];
	catalog: SupplierCatalog;
	/** Open requests only: flagged parts can be settled. */
	editable: boolean;
	focus: string | null;
	onFocus: (partId: string | null) => void;
	field: RenderField;
}) {
	return (
		<DataTable
			tableId={`parts-${request.id}`}
			columns={partColumns(focus, onFocus)}
			rows={rows.map((r) => ({ ...r, id: r.part.id }))}
			rowClassName={(row) => (focus === row.part.id ? "bg-accent-subtle" : undefined)}
			renderRowDetail={(row) =>
				editable && (row.missing || row.unsure) ? (
					<FixRow row={row} request={request} catalog={catalog} field={field} />
				) : null
			}
		/>
	);
}
