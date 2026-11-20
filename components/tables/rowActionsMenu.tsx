"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, Pencil, Trash2, MoreHorizontal } from "lucide-react";
import { Menu, MenuItem } from "./menu";
import { IconButton, IconLink } from "./table";
import type { ViewAction, EditAction, DeleteAction, LinkAction, RowAction } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// LinkActionText
// Separate component so it can call useSearchParams (a hook) inside a row
// render without breaking the rules-of-hooks ordering in DataTable itself.
// ─────────────────────────────────────────────────────────────────────────────

function LinkActionText<TRow extends { id: string }>({
	row,
	action,
}: {
	row: TRow;
	action: LinkAction<TRow>;
}) {
	const searchParams = useSearchParams();
	const { mergeParams = true, linkIcon } = action;

	const rawHref = action.href(row);

	const finalHref = (() => {
		if (!mergeParams) return rawHref;
		// Parse the href the parent gave us
		const [rawPath, rawQuery] = rawHref.split("?");
		// Start from the current URL params to preserve table state
		const merged = new URLSearchParams(searchParams.toString());
		// Overlay the params from the parent href
		new URLSearchParams(rawQuery ?? "").forEach((v, k) => merged.set(k, v));
		const qs = merged.toString();
		return qs ? `${rawPath}?${qs}` : rawPath;
	})();

	return (
		<Link
			href={finalHref}
			className="inline-flex items-center gap-1 px-2 text-body font-bold whitespace-nowrap text-accent-fg hover:underline [&_svg]:size-4"
		>
			{action.label}
			{linkIcon}
		</Link>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// RowActionsMenu — the actions cell. As in the design, view / edit / delete
// are inline icon buttons (the delete one turns red on hover) and a text link
// can sit beside them. Custom row actions don't fit as icons, so they go in a
// "More actions" menu at the end.
// ─────────────────────────────────────────────────────────────────────────────

export function RowActionsMenu<TRow extends { id: string }>({
	row,
	viewAction,
	editAction,
	deleteAction,
	linkAction,
	rowActions = [],
	onOpenSheet,
	onOpenEdit,
	onOpenDelete,
}: {
	row: TRow;
	viewAction?: ViewAction<TRow>;
	editAction?: EditAction<TRow>;
	deleteAction?: DeleteAction<TRow>;
	linkAction?: LinkAction<TRow>;
	rowActions?: RowAction<TRow>[];
	onOpenSheet: () => void;
	onOpenEdit: () => void;
	onOpenDelete: () => void;
}) {
	// A row whose actions are all hidden gets nothing, rather than an empty cell
	const visibleRowActions = rowActions.filter((action) => !action.hidden?.(row));
	if (!viewAction && !editAction && !deleteAction && !linkAction && visibleRowActions.length === 0) return null;

	return (
		<div className="inline-flex items-center justify-end gap-0.5">
			{linkAction && <LinkActionText row={row} action={linkAction} />}

			{viewAction &&
				(viewAction.type === "link" ? (
					<IconLink href={viewAction.href(row)} aria-label="View" title="View">
						<Eye aria-hidden="true" />
					</IconLink>
				) : (
					<IconButton
						aria-label="View"
						title="View"
						onClick={() => (viewAction.type === "sheet" ? onOpenSheet() : viewAction.onClick(row))}
					>
						<Eye aria-hidden="true" />
					</IconButton>
				))}

			{editAction &&
				(editAction.type === "link" ? (
					<IconLink href={editAction.href(row)} aria-label="Edit" title="Edit">
						<Pencil aria-hidden="true" />
					</IconLink>
				) : (
					<IconButton aria-label="Edit" title="Edit" onClick={onOpenEdit}>
						<Pencil aria-hidden="true" />
					</IconButton>
				))}

			{deleteAction && (
				<IconButton danger aria-label="Delete" title="Delete" onClick={onOpenDelete}>
					<Trash2 aria-hidden="true" />
				</IconButton>
			)}

			{visibleRowActions.length > 0 && (
				<Menu
					label="More actions"
					triggerClassName="inline-grid size-8 cursor-pointer place-items-center rounded-md text-fg-secondary hover:bg-subtle hover:text-fg aria-expanded:bg-subtle [&_svg]:size-4.5"
					trigger={<MoreHorizontal aria-hidden="true" />}
				>
					{visibleRowActions.map((action) => {
						const disabledReason = action.disabledReason?.(row) ?? null;
						return (
							<MenuItem
								key={action.label}
								disabled={!!disabledReason}
								tone={action.tone}
								onSelect={() => action.onSelect(row)}
								className={disabledReason ? "items-start py-2" : undefined}
							>
								{action.icon}
								{/* Why it's off, under it — a tooltip alone never shows on touch screens */}
								{disabledReason ? (
									<span className="flex flex-col">
										{action.label}
										<span className="text-small text-fg-tertiary">{disabledReason}</span>
									</span>
								) : (
									action.label
								)}
							</MenuItem>
						);
					})}
				</Menu>
			)}
		</div>
	);
}
