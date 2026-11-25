"use client";

import Link from "next/link";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/common/badge";
import {
	DataTable,
	ExportMenu,
	IconButton,
	TableToolbar,
	exportRows,
	useTableRows,
	type ColumnDef,
	type ExportColumn,
	type ExportFormat,
} from "@/components/tables";
import {
	PART_CATEGORIES,
	availableOf,
	costLabel,
	costUpdatedLabel,
	shortfallsOf,
	stockFlag,
	type Inventory,
	type Part,
} from "@/lib/inventory";
import { offersFor, type SupplierCatalog } from "@/lib/suppliers";
import PartThumb from "./partThumb";

export const INVENTORY_TABLE_ID = "inventory";

/** A row in the inventory table: the part with the figures the table filters and sorts on. */
export type PartRow = Part & {
	available: number;
	flag: "Out" | "Low" | null;
	/** "low" and/or "short", for the Show filter. */
	flags: string[];
	supplierName: string;
	/** "1 other supplier", "Only supplier". */
	supplierNote: string;
	updatedLabel: string;
	searchText: string;
};

export function toPartRows(
	inventory: Inventory,
	catalog: SupplierCatalog,
	today: string,
): PartRow[] {
	const shortSkus = new Set(shortfallsOf(inventory).map((s) => s.sku));
	return inventory.parts
		.map((p) => {
			const flag = stockFlag(p);
			const others = offersFor(catalog, p.sku).filter(
				(o) => o.supplier.id !== p.supplierId,
			).length;
			return {
				...p,
				available: availableOf(p),
				flag,
				flags: [flag ? "low" : "", shortSkus.has(p.sku) ? "short" : ""].filter(Boolean),
				supplierName:
					catalog.suppliers.find((s) => s.id === p.supplierId)?.business ??
					"No supplier set",
				supplierNote: others
					? `${others} other supplier${others === 1 ? "" : "s"}`
					: "Only supplier",
				updatedLabel: costUpdatedLabel(p, today),
				searchText: `${p.name} ${p.sku}`,
			};
		})
		.sort((a, b) => a.name.localeCompare(b.name));
}

/** The table's columns. `onEdit` opens a part's edit drawer. */
export function partColumns(onEdit: (part: PartRow) => void): ColumnDef<PartRow>[] {
	return [
		{
			key: "part",
			header: "Part",
			cell: (p) => (
				<span className="flex min-w-56 items-center gap-3">
					<PartThumb part={p} />
					<span className="flex min-w-0 flex-col">
						<strong className="text-fg">{p.name}</strong>
						<span className="text-small text-fg-tertiary">
							{p.sku} · {p.category} · {p.spec}
						</span>
					</span>
				</span>
			),
		},
		{
			key: "supplier",
			header: "Preferred supplier",
			cell: (p) => (
				<span className="flex min-w-40 flex-col">
					{p.supplierId ? (
						<Link
							href={`/suppliers/${p.supplierId}`}
							className="text-fg no-underline hover:underline"
						>
							{p.supplierName}
						</Link>
					) : (
						<span className="text-fg-secondary">{p.supplierName}</span>
					)}
					<span className="text-small text-fg-tertiary">{p.supplierNote}</span>
				</span>
			),
		},
		{
			key: "available",
			header: "Available",
			className: "text-end",
			cell: (p) => (
				<span className="flex flex-col items-end">
					<span className="inline-flex items-center gap-2">
						{p.flag && (
							<Badge variant={p.flag === "Out" ? "danger" : "warning"}>
								{p.flag}
							</Badge>
						)}
						<strong className="text-fg tabular">{p.available}</strong>
					</span>
					<span className="text-small whitespace-nowrap text-fg-tertiary">
						{p.inStock} in stock, {p.reserved} reserved
					</span>
				</span>
			),
		},
		{
			key: "cost",
			header: "Unit cost",
			className: "text-end",
			cell: (p) => (
				<span className="flex flex-col items-end">
					<strong className="text-fg tabular">{costLabel(p.unitCost)}</strong>
					<span className="text-small whitespace-nowrap text-fg-tertiary">
						per {p.unit} · {p.updatedLabel}
					</span>
				</span>
			),
		},
		{
			key: "actions",
			header: <span className="sr-only">Actions</span>,
			className: "w-14 text-end",
			cell: (p) => (
				<IconButton
					aria-label={`Edit ${p.name}`}
					title="Edit part"
					onClick={() => onEdit(p)}
				>
					<Pencil aria-hidden="true" />
				</IconButton>
			),
		},
	];
}

export default function InventoryTable({
	data,
	today,
	onEdit,
}: {
	data: PartRow[];
	today: string;
	onEdit: (part: PartRow) => void;
}) {
	const { rows, pagination } = useTableRows({
		tableId: INVENTORY_TABLE_ID,
		data,
		searchFields: ["searchText"],
		filters: [
			{ paramKey: "show", field: "flags", matchMode: "includes" },
			{ paramKey: "category", field: "category" },
		],
		sortOptions: [
			{ value: "available", field: "available", type: "number", direction: "asc" },
			{ value: "cost", field: "unitCost", type: "number", direction: "desc" },
		],
		rowsPerPage: 10,
	});

	const exportColumns: ExportColumn<PartRow>[] = [
		{ header: "SKU", value: (p) => p.sku },
		{ header: "Part", value: (p) => p.name },
		{ header: "Category", value: (p) => p.category },
		{ header: "Spec", value: (p) => p.spec, skipInPdf: true },
		{ header: "Unit", value: (p) => p.unit },
		{ header: "Unit cost (₦)", value: (p) => p.unitCost, kind: "number" },
		{ header: "In stock", value: (p) => p.inStock, kind: "number" },
		{ header: "Reserved", value: (p) => p.reserved, kind: "number" },
		{ header: "Available", value: (p) => p.available, kind: "number" },
		{ header: "Reorder level", value: (p) => p.reorderLevel, kind: "number" },
		{ header: "Preferred supplier", value: (p) => p.supplierName },
	];

	const exportParts = async (format: ExportFormat) => {
		await exportRows(data, exportColumns, {
			format,
			filename: `inventory-${today}`,
			title: "Inventory & parts",
		});
		toast.success(`Exported ${data.length} parts with stock and unit costs.`);
	};

	const count = (flag: string) => data.filter((p) => p.flags.includes(flag)).length;

	return (
		<DataTable
			tableId={INVENTORY_TABLE_ID}
			columns={partColumns(onEdit)}
			rows={rows}
			pagination={pagination}
			emptyMessage="No parts match. Try a different name or SKU, or clear the filters."
			toolbar={
				<TableToolbar
					search={{ placeholder: "Part name or SKU" }}
					filters={[
						{
							title: "Show",
							paramKey: "show",
							items: [
								{ label: `Low stock (${count("low")})`, value: "low" },
								{
									label: `Short for job cards (${count("short")})`,
									value: "short",
								},
							],
						},
						{
							title: "Category",
							paramKey: "category",
							items: PART_CATEGORIES.map((c) => ({ label: c, value: c })),
						},
					]}
					sortBy={{
						title: "Sort by",
						placeholder: "Name, A to Z",
						items: [
							{ label: "Available, lowest first", value: "available" },
							{ label: "Unit cost, highest first", value: "cost" },
						],
					}}
					actions={<ExportMenu onExport={exportParts} disabled={data.length === 0} />}
				/>
			}
		/>
	);
}
