"use client";

import { useState, useCallback, type MouseEvent, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/common/buttons";
import { Card } from "@/components/common/card";
import { Drawer } from "@/components/common/drawer";
import { Table } from "./table";
import { TableIdContext, useTableParam } from "./tableContext";
import { TableDialog } from "./tableDialog";
import { RowActionsMenu } from "./rowActionsMenu";
import { TableSkeletonRows } from "./tableSkeletonRows";
import type {
	ColumnDef,
	PaginationMeta,
	ViewAction,
	EditAction,
	DeleteAction,
	LinkAction,
	RowAction,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// getPageNumbers — windowed page list with ellipsis gaps, e.g.
// [1, 2, 3, 4, 5], [1, "…", 4, 5, 6, "…", 20]
// ─────────────────────────────────────────────────────────────────────────────

function getPageNumbers(current: number, total: number): (number | "…")[] {
	const siblingCount = 1;
	const totalSlots = siblingCount * 2 + 5; // first, last, current, 2 siblings, 2 ellipses

	if (total <= totalSlots) {
		return Array.from({ length: total }, (_, i) => i + 1);
	}

	const left = Math.max(current - siblingCount, 2);
	const right = Math.min(current + siblingCount, total - 1);

	const pages: (number | "…")[] = [1];
	if (left > 2) pages.push("…");
	for (let p = left; p <= right; p++) pages.push(p);
	if (right < total - 1) pages.push("…");
	pages.push(total);

	return pages;
}

// ─────────────────────────────────────────────────────────────────────────────
// PaginationBar — "Showing 1 - 10 of 24" and the page buttons
// ─────────────────────────────────────────────────────────────────────────────

function PaginationBar({
	page,
	pagination,
	onPageChange,
	loading = false,
}: {
	page: number;
	pagination: PaginationMeta;
	onPageChange: (page: number) => void;
	/** The rows are still loading: the count is a skeleton and the buttons are off. */
	loading?: boolean;
}) {
	const totalPages = Math.max(1, pagination.totalPages);
	const { rowsPerPage, total } = pagination;

	const label =
		total === 0
			? "0 results"
			: `Showing ${(page - 1) * rowsPerPage + 1}–${Math.min(page * rowsPerPage, total)} of ${total}`;

	return (
		<nav
			aria-label="Pagination"
			className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3"
		>
			{loading ? (
				<div aria-hidden="true" className="h-4 w-32 animate-pulse rounded-sm bg-subtle" />
			) : (
				<span className="text-small text-fg-secondary tabular">{label}</span>
			)}
			<div className="flex items-center gap-1">
				<Button
					size="sm"
					icon
					aria-label="Previous page"
					onClick={() => onPageChange(page - 1)}
					disabled={loading || page <= 1}
				>
					<ChevronLeft />
				</Button>
				{getPageNumbers(page, totalPages).map((p, i) =>
					p === "…" ? (
						<span
							key={`ellipsis-${i}`}
							aria-hidden="true"
							className="px-2 text-body text-fg-tertiary select-none"
						>
							…
						</span>
					) : (
						<button
							key={p}
							type="button"
							onClick={() => onPageChange(p)}
							aria-current={p === page ? "page" : undefined}
							aria-label={`Page ${p}`}
							className={cn(
								"h-8 min-w-8 cursor-pointer rounded-md border px-2 text-body tabular transition-colors",
								p === page
									? "border-line bg-subtle font-bold text-fg"
									: "border-transparent text-fg-secondary hover:bg-subtle hover:text-fg",
							)}
						>
							{p}
						</button>
					),
				)}
				<Button
					size="sm"
					icon
					aria-label="Next page"
					onClick={() => onPageChange(page + 1)}
					disabled={loading || page >= totalPages}
				>
					<ChevronRight />
				</Button>
			</div>
		</nav>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// DataTable
// ─────────────────────────────────────────────────────────────────────────────

export interface DataTableProps<TRow extends { id: string }> {
	tableId: string;
	columns: ColumnDef<TRow>[];
	rows: TRow[];
	/**
	 * Omit for a short, fixed list (e.g. a dashboard preview): no pagination
	 * bar, and the table never reads the URL — so it needs no Suspense
	 * boundary on a static page.
	 */
	pagination?: PaginationMeta;
	toolbar?: ReactNode;
	loading?: boolean;
	/** The rows couldn't load: shown in place of the rows, under the real headers. */
	error?: ReactNode;
	emptyMessage?: string;
	/** Eye icon — "link" navigates, "popup" fires onClick */
	viewAction?: ViewAction<TRow>;
	/** Pencil icon — opens Edit dialog with parent-supplied body */
	editAction?: EditAction<TRow>;
	/** Trash icon — opens Delete confirmation dialog */
	deleteAction?: DeleteAction<TRow>;
	/** Plain text link in the actions cell — no icon */
	linkAction?: LinkAction<TRow>;
	/** Custom items in the row's "..." menu, e.g. "Suspend" */
	rowActions?: RowAction<TRow>[];
	/** Adds a leading "#" column numbered from the current page's offset */
	showIndex?: boolean;
	/** Adds a leading checkbox column for row selection */
	selectable?: boolean;
	/** Controlled selection — pass together with onSelectionChange */
	selectedIds?: string[];
	onSelectionChange?: (ids: string[]) => void;
	/**
	 * Controlled page — pass together with onPageChange when the page lives
	 * in the parent's state. Otherwise it's read from the `<tableId>_page`
	 * URL param.
	 */
	page?: number;
	onPageChange?: (page: number) => void;
	/** Makes the whole row clickable. Checkbox and actions cells don't trigger it. */
	onRowClick?: (row: TRow) => void;
	/** Tighter cell padding, for a table inside a card (e.g. a dashboard preview). */
	compact?: boolean;
}

export function DataTable<TRow extends { id: string }>(props: DataTableProps<TRow>) {
	// Only a paginated table that doesn't control its own page reads the
	// URL (useSearchParams), so the others work on static pages as-is
	return props.pagination && !props.onPageChange ? (
		<UrlPagedDataTable {...props} />
	) : (
		<DataTableContent {...props} />
	);
}

function UrlPagedDataTable<TRow extends { id: string }>(props: DataTableProps<TRow>) {
	const { getParam, setParam } = useTableParam(props.tableId);
	return (
		<DataTableContent
			{...props}
			page={Number(getParam("page") ?? 1)}
			onPageChange={(p) => setParam("page", String(p))}
		/>
	);
}

function DataTableContent<TRow extends { id: string }>({
	tableId,
	columns,
	rows,
	pagination,
	toolbar,
	viewAction,
	editAction,
	deleteAction,
	linkAction,
	rowActions,
	showIndex = false,
	selectable = false,
	selectedIds,
	onSelectionChange,
	page: rawPage = 1,
	onPageChange,
	onRowClick,
	compact = false,
	loading = false,
	error,
	emptyMessage = "No results match your filters.",
}: DataTableProps<TRow>) {
	const page = Math.max(1, rawPage);
	// Index of the first row on this page, for the "#" column
	const offset = pagination ? (page - 1) * pagination.rowsPerPage : 0;

	// Keeps checkbox / actions clicks from also firing onRowClick
	const stopRowClick = (event: MouseEvent) => event.stopPropagation();

	// ── Dialog state ────────────────────────────────────────────────────────
	type PanelKind = "edit" | "delete" | "sheet" | null;
	const [activeRow, setActiveRow] = useState<TRow | null>(null);
	const [panelKind, setPanelKind] = useState<PanelKind>(null);

	const openPanel = useCallback((kind: Exclude<PanelKind, null>, row: TRow) => {
		setActiveRow(row);
		setPanelKind(kind);
	}, []);
	const closePanel = useCallback(() => {
		setPanelKind(null);
		setActiveRow(null);
	}, []);

	const handleEditConfirm = () => {
		if (activeRow && editAction && editAction.type !== "link") {
			editAction.onConfirm(activeRow);
			closePanel();
		}
	};
	const handleDeleteConfirm = () => {
		if (activeRow && deleteAction) {
			deleteAction.onConfirm(activeRow);
			closePanel();
		}
	};

	// ── Selection state ─────────────────────────────────────────────────────
	const [internalSelected, setInternalSelected] = useState<Set<string>>(new Set());
	const selected = selectedIds ? new Set(selectedIds) : internalSelected;

	const updateSelection = (next: Set<string>) => {
		if (!selectedIds) setInternalSelected(next);
		onSelectionChange?.(Array.from(next));
	};

	const toggleRow = (id: string) => {
		const next = new Set(selected);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		updateSelection(next);
	};

	const allSelectedOnPage = rows.length > 0 && rows.every((r) => selected.has(r.id));
	const someSelectedOnPage = !allSelectedOnPage && rows.some((r) => selected.has(r.id));

	const toggleAllOnPage = () => {
		const next = new Set(selected);
		if (allSelectedOnPage) rows.forEach((r) => next.delete(r.id));
		else rows.forEach((r) => next.add(r.id));
		updateSelection(next);
	};

	const hasActions = Boolean(
		viewAction || editAction || deleteAction || linkAction || rowActions?.length,
	);

	const colCount =
		columns.length + (hasActions ? 1 : 0) + (showIndex ? 1 : 0) + (selectable ? 1 : 0);

	return (
		<TableIdContext.Provider value={tableId}>
			<Card flush className="overflow-hidden">
				{toolbar}

				<Table className={compact ? "[&_td]:py-2" : undefined}>
					<thead>
						<tr>
							{selectable && (
								<th scope="col" className="w-10">
									<input
										type="checkbox"
										ref={(el) => {
											if (el) el.indeterminate = someSelectedOnPage;
										}}
										checked={allSelectedOnPage}
										onChange={toggleAllOnPage}
										aria-label="Select all rows on this page"
										className="size-4 cursor-pointer accent-accent"
									/>
								</th>
							)}
							{showIndex && (
								<th scope="col" className="w-10">
									#
								</th>
							)}
							{columns.map((col) => (
								<th key={col.key} scope="col" className={col.className}>
									{col.header ?? col.key}
								</th>
							))}
							{hasActions && (
								<th scope="col" className="w-14 text-end">
									<span className="sr-only">Actions</span>
								</th>
							)}
						</tr>
					</thead>

					<tbody>
						{loading ? (
							<TableSkeletonRows cols={colCount} />
						) : error ? (
							<tr>
								<td
									colSpan={colCount}
									role="alert"
									className="px-5! py-8! text-center text-danger-fg!"
								>
									{error}
								</td>
							</tr>
						) : rows.length === 0 ? (
							<tr>
								<td colSpan={colCount} className="px-5! py-8! text-center">
									{emptyMessage}
								</td>
							</tr>
						) : (
							rows.map((row, i) => (
								<tr
									key={row.id}
									onClick={onRowClick ? () => onRowClick(row) : undefined}
									className={onRowClick ? "cursor-pointer" : undefined}
								>
									{selectable && (
										<td className="w-10" onClick={stopRowClick}>
											<input
												type="checkbox"
												checked={selected.has(row.id)}
												onChange={() => toggleRow(row.id)}
												aria-label="Select row"
												className="size-4 cursor-pointer accent-accent"
											/>
										</td>
									)}
									{showIndex && (
										<td className="w-10 tabular">{offset + i + 1}</td>
									)}
									{columns.map((col) => (
										<td key={col.key} className={col.className}>
											{col.cell
												? col.cell(row)
												: String(
														(row as Record<string, unknown>)[col.key] ??
															"",
													)}
										</td>
									))}
									{/* ── Actions cell ─────────────────────────────────────── */}
									{hasActions && (
										<td
											className="text-end whitespace-nowrap"
											onClick={stopRowClick}
										>
											<RowActionsMenu
												row={row}
												viewAction={viewAction}
												editAction={editAction}
												deleteAction={deleteAction}
												linkAction={linkAction}
												rowActions={rowActions}
												onOpenSheet={() => openPanel("sheet", row)}
												onOpenEdit={() => openPanel("edit", row)}
												onOpenDelete={() => openPanel("delete", row)}
											/>
										</td>
									)}
								</tr>
							))
						)}
					</tbody>
				</Table>

				{pagination && (
					<PaginationBar
						page={page}
						pagination={pagination}
						onPageChange={(p) => onPageChange?.(p)}
						loading={loading}
					/>
				)}
			</Card>

			{/* Edit drawer — only rendered when editAction is the dialog variant */}
			{editAction && editAction.type !== "link" && (
				<TableDialog
					open={panelKind === "edit"}
					onClose={closePanel}
					onConfirm={handleEditConfirm}
					variant="edit"
					title="Edit details"
					confirmLabel={editAction.confirmLabel ?? "Save changes"}
				>
					{activeRow ? editAction.dialogContent(activeRow) : null}
				</TableDialog>
			)}

			{/* Delete confirmation */}
			{deleteAction && (
				<TableDialog
					open={panelKind === "delete"}
					onClose={closePanel}
					onConfirm={handleDeleteConfirm}
					variant="delete"
					title={`Delete ${deleteAction.dataType}?`}
					confirmLabel="Delete"
				>
					{activeRow ? deleteAction.dialogContent(activeRow) : null}
				</TableDialog>
			)}

			{/* View drawer, sliding in from the right */}
			{viewAction && viewAction.type === "sheet" && panelKind === "sheet" && (
				<Drawer
					title={activeRow ? (viewAction.title?.(activeRow) ?? "Details") : "Details"}
					onClose={closePanel}
				>
					{activeRow ? viewAction.content(activeRow) : null}
				</Drawer>
			)}
		</TableIdContext.Provider>
	);
}
