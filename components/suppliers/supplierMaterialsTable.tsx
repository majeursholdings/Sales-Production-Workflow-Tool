"use client";

import type { ReactNode } from "react";
import { Eye } from "lucide-react";
import { Badge } from "@/components/common/badge";
import { DataTable, IconButton, TableState, type ColumnDef } from "@/components/tables";
import { cn } from "@/lib/cn";
import { wholeNaira } from "@/lib/quoteBuilder";
import {
	compareOffer,
	daysLabel,
	formatScore,
	materialOf,
	preferredSupplierId,
	scoreOf,
	type Supplier,
	type SupplierCatalog,
	type SupplierMaterial,
} from "@/lib/suppliers";
import MaterialThumb from "./materialThumb";

/** A material row with how it compares, worked out once for the cells. */
type MaterialRow = SupplierMaterial & {
	id: string;
	name: string;
	unit: string;
	score: number | null;
	preferred: boolean;
	cmp: ReturnType<typeof compareOffer>;
};

const subNote = (good: boolean, text: string) =>
	text ? (
		<span className={cn("text-small", good ? "text-success-fg" : "text-fg-tertiary")}>
			{text}
		</span>
	) : null;

export const materialColumns = (onView?: (sku: string) => void): ColumnDef<MaterialRow>[] => [
	{
		key: "material",
		header: "Material",
		cell: (m) => (
			<span className="flex min-w-48 items-center gap-3">
				<MaterialThumb sku={m.sku} />
				<span className="flex min-w-0 flex-col">
					<span className="font-bold text-fg">{m.name}</span>
					<span className="text-small text-fg-tertiary">{m.sku}</span>
				</span>
			</span>
		),
	},
	{
		key: "price",
		header: "Their price",
		className: "text-end",
		cell: (m) => (
			<span className="flex flex-col items-end whitespace-nowrap">
				<span className="font-bold text-fg tabular">{wholeNaira(m.price)}</span>
				<span className="text-small text-fg-tertiary">per {m.unit}</span>
				{subNote(m.cmp.isLowest, m.cmp.priceNote)}
			</span>
		),
	},
	{
		key: "lead",
		header: "Lead time",
		className: "text-end",
		cell: (m) => (
			<span className="flex flex-col items-end whitespace-nowrap">
				<span className="font-bold text-fg">{daysLabel(m.leadDays)}</span>
				{subNote(m.cmp.isFastest, m.cmp.leadNote)}
			</span>
		),
	},
	{
		key: "score",
		header: "Score /5",
		className: "text-end",
		cell: (m) => (
			<span className="flex flex-col items-end gap-1">
				<span className="font-display text-h3 font-bold text-fg tabular">
					{formatScore(m.score)}
				</span>
				{m.score === null && (
					<span className="text-small whitespace-nowrap text-fg-tertiary">
						Not rated yet
					</span>
				)}
				{m.preferred && <Badge variant="success">Preferred</Badge>}
			</span>
		),
	},
	{
		key: "actions",
		header: <span className="sr-only">Actions</span>,
		className: "w-14 text-end",
		cell: (m) => (
			<IconButton
				aria-label={`View ${m.name}`}
				title="View material"
				onClick={() => onView?.(m.sku)}
			>
				<Eye aria-hidden="true" />
			</IconButton>
		),
	},
];

/** The materials a supplier sells us, with how each compares with the other suppliers of it. A short list, so no paging. */
export default function SupplierMaterialsTable({
	catalog,
	supplier,
	header,
	onView,
}: {
	catalog: SupplierCatalog;
	supplier: Supplier;
	header: ReactNode;
	onView: (sku: string) => void;
}) {
	const rows: MaterialRow[] = supplier.materials.map((m) => {
		const material = materialOf(catalog, m.sku);
		return {
			...m,
			id: m.sku,
			name: material.name,
			unit: material.unit,
			score: scoreOf(m.ratings),
			preferred: preferredSupplierId(catalog, m.sku) === supplier.id,
			cmp: compareOffer(catalog, supplier.id, m.sku),
		};
	});

	return (
		<DataTable
			tableId="supplier-materials"
			columns={materialColumns(onView)}
			rows={rows}
			toolbar={header}
			emptyState={
				<TableState
					kind="empty"
					title="No materials yet"
					description="Use More actions › Add material to add what they supply, then rate it after the first delivery."
				/>
			}
		/>
	);
}
