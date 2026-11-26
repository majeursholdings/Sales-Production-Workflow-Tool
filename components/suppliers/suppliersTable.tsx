"use client";

import Link from "next/link";
import { Eye, MapPin, Phone } from "lucide-react";
import { toast } from "sonner";
import { Chip } from "@/components/common/badge";
import {
	DataTable,
	ExportMenu,
	IconLink,
	TableToolbar,
	exportRows,
	useTableRows,
	type ColumnDef,
	type ExportColumn,
	type ExportFormat,
} from "@/components/tables";
import { useTableParam } from "@/components/tables/tableContext";
import {
	formatScore,
	materialOf,
	offersFor,
	plural,
	preferredSupplierId,
	scoreOf,
	supplierRating,
	type Supplier,
	type SupplierCatalog,
} from "@/lib/suppliers";

const TABLE_ID = "suppliers";

/** A row in the suppliers table: the supplier with the figures the table filters and sorts on. */
export type SupplierRow = Supplier & {
	/** Overall rating, or -1 when nothing is rated, so unrated suppliers sort last. */
	rating: number;
	skus: string[];
	materialCount: number;
	/** SKU → material name, from inventory. */
	materialNames: Record<string, string>;
	/** Business, contact and material names, for the search box. */
	searchText: string;
};

export const supplierColumns: ColumnDef<SupplierRow>[] = [
	{
		key: "supplier",
		header: "Supplier",
		cell: (s) => (
			<span className="flex min-w-48 flex-col">
				<Link
					href={`/suppliers/${s.id}`}
					className="font-bold text-fg no-underline hover:underline"
				>
					{s.business}
				</Link>
				<span className="text-small text-fg-tertiary">
					{s.contact} · {s.onTimePercent}% on time ·{" "}
					{plural(s.deliveries, "delivery", "deliveries")}
				</span>
			</span>
		),
	},
	{
		key: "contact",
		header: "Contact & address",
		cell: (s) => (
			<span className="flex min-w-48 flex-col gap-1 text-small [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-fg-tertiary">
				<a
					href={`tel:${s.phone.replace(/\s/g, "")}`}
					className="flex items-center gap-2 whitespace-nowrap text-fg-secondary no-underline hover:text-fg hover:underline"
				>
					<Phone aria-hidden="true" />
					{s.phone}
				</a>
				<span className="flex items-center gap-2">
					<MapPin aria-hidden="true" />
					{s.area}
				</span>
			</span>
		),
	},
	{
		key: "materials",
		header: "Materials supplied",
		cell: (s) => (
			<span className="flex max-w-80 flex-wrap gap-1">
				{s.materials.map((m) => (
					<Chip key={m.sku}>
						{s.materialNames[m.sku] ?? m.sku} · {formatScore(scoreOf(m.ratings))}
					</Chip>
				))}
			</span>
		),
	},
	{
		key: "rating",
		header: "Rating /5",
		className: "text-end",
		cell: (s) => (
			<span className="flex flex-col items-end">
				<span
					className="font-bold text-fg tabular"
					aria-label={
						s.rating < 0 ? "Not rated yet" : `Rated ${formatScore(s.rating)} out of 5`
					}
				>
					{s.rating < 0 ? "—" : formatScore(s.rating)}
				</span>
				<span className="text-small whitespace-nowrap text-fg-tertiary">
					across {plural(s.materialCount, "material")}
				</span>
			</span>
		),
	},
	{
		key: "actions",
		header: <span className="sr-only">Actions</span>,
		className: "w-14 text-end",
		cell: (s) => (
			<IconLink
				href={`/suppliers/${s.id}`}
				aria-label={`Open ${s.business}`}
				title="Open supplier"
			>
				<Eye aria-hidden="true" />
			</IconLink>
		),
	},
];

export function toSupplierRows(catalog: SupplierCatalog): SupplierRow[] {
	return catalog.suppliers
		.map((s) => ({
			...s,
			materialNames: Object.fromEntries(
				s.materials.map((m) => [m.sku, materialOf(catalog, m.sku).name]),
			),
			rating: supplierRating(s) ?? -1,
			skus: s.materials.map((m) => m.sku),
			materialCount: s.materials.length,
			searchText: [
				s.business,
				s.contact,
				...s.materials.map((m) => materialOf(catalog, m.sku).name),
			].join(" "),
		}))
		.sort((a, b) => b.rating - a.rating);
}

/** "Walnut hardwood: 2 suppliers. Preferred: <supplier>." under the toolbar while a material is picked. */
function MaterialNote({ catalog }: { catalog: SupplierCatalog }) {
	const { getParam } = useTableParam(TABLE_ID);
	const sku = getParam("material");
	if (!sku) return null;
	const offers = offersFor(catalog, sku);
	if (!offers.length) return null;
	const preferredId = preferredSupplierId(catalog, sku);
	const preferred = catalog.suppliers.find((s) => s.id === preferredId);

	return (
		<p className="border-b border-line px-5 py-3 text-small text-fg-secondary">
			{materialOf(catalog, sku).name}: {plural(offers.length, "supplier")}.{" "}
			{preferred ? `Preferred: ${preferred.business}. ` : "No preferred supplier yet. "}
			Open a supplier and use Compare to see them side by side.
		</p>
	);
}

export default function SuppliersTable({
	catalog,
	today,
}: {
	catalog: SupplierCatalog;
	today: string;
}) {
	const data = toSupplierRows(catalog);
	const { rows, pagination } = useTableRows({
		tableId: TABLE_ID,
		data,
		searchFields: ["searchText"],
		filters: [{ paramKey: "material", field: "skus", matchMode: "includes" }],
		sortOptions: [
			{ value: "name", field: "business" },
			{ value: "materials", field: "materialCount", type: "number", direction: "desc" },
		],
		rowsPerPage: 10,
	});

	const exportColumns: ExportColumn<SupplierRow>[] = [
		{ header: "Business", value: (s) => s.business },
		{ header: "Contact", value: (s) => s.contact },
		{ header: "Phone", value: (s) => s.phone },
		{ header: "Email", value: (s) => s.email, skipInPdf: true },
		{ header: "Address", value: (s) => s.address, skipInPdf: true },
		{
			header: "Materials (price, score)",
			value: (s) =>
				s.materials
					.map(
						(m) =>
							`${materialOf(catalog, m.sku).name} (₦${m.price.toLocaleString("en-NG")}, ${formatScore(scoreOf(m.ratings))})`,
					)
					.join("; "),
		},
		{
			header: "Rating /5",
			value: (s) => (s.rating < 0 ? null : Number(s.rating.toFixed(1))),
			kind: "number",
		},
		{ header: "On time (%)", value: (s) => s.onTimePercent, kind: "number" },
	];

	const exportSuppliers = async (format: ExportFormat) => {
		await exportRows(data, exportColumns, {
			format,
			filename: `suppliers-${today}`,
			title: "Suppliers",
		});
		toast.success(
			`Exported ${data.length} suppliers with their materials, prices and ratings. Bank account numbers are left out of exports.`,
		);
	};

	const supplied = catalog.materials.filter((m) => offersFor(catalog, m.sku).length > 0);

	return (
		<DataTable
			tableId={TABLE_ID}
			columns={supplierColumns}
			rows={rows}
			pagination={pagination}
			emptyMessage="No suppliers match your search. Try a business, contact or material name."
			toolbar={
				<>
					<TableToolbar
						search={{ placeholder: "Business, contact or material" }}
						filters={[
							{
								title: "Supplies",
								paramKey: "material",
								items: supplied.map((m) => ({
									label: `${m.name} (${offersFor(catalog, m.sku).length})`,
									value: m.sku,
								})),
							},
						]}
						sortBy={{
							title: "Sort by",
							placeholder: "Rating, highest first",
							items: [
								{ label: "Business, A to Z", value: "name" },
								{ label: "Most materials", value: "materials" },
							],
						}}
						actions={
							<ExportMenu onExport={exportSuppliers} disabled={data.length === 0} />
						}
					/>
					<MaterialNote catalog={catalog} />
				</>
			}
		/>
	);
}
