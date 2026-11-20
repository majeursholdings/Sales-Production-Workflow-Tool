"use client";

import type { ReactNode } from "react";
import { SearchInput, type SearchInputProps } from "./searchInput";
import { SelectFilter, type SelectFilterProps } from "./selectFilter";
import { DateSortFilter } from "./dateSortFilter";

// ─────────────────────────────────────────────────────────────────────────────
// TableToolbar — the bar along the top of a table's card: search, filters,
// sort, then the actions (primary button, Export) pushed to the right.
// Pass it as DataTable's `toolbar`.
// ─────────────────────────────────────────────────────────────────────────────

export interface TableToolbarProps {
	search?: SearchInputProps;
	/** Up to 3 select filters */
	filters?: SelectFilterProps[];
	/**
	 * Enable the "Sort by" newest / oldest select.
	 * Only meaningful when `sortField` is also declared on useTableRows.
	 */
	dateSort?: boolean;
	/**
	 * Generic "Sort by" select — e.g. by project name, date, or amount.
	 * Only meaningful when `sortOptions` is also declared on useTableRows.
	 * Sits before `actions`.
	 */
	sortBy?: Omit<SelectFilterProps, "paramKey"> & { paramKey?: string };
	actions?: ReactNode;
}

export function TableToolbar({ search, filters = [], dateSort = false, sortBy, actions }: TableToolbarProps) {
	return (
		<div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
			{search && <SearchInput {...search} />}
			{filters.slice(0, 3).map((f) => (
				<SelectFilter key={f.paramKey} {...f} />
			))}
			{dateSort && <DateSortFilter />}
			{(sortBy || actions) && (
				<div className="ml-auto flex flex-wrap items-center gap-3">
					{sortBy && (
						<SelectFilter
							{...sortBy}
							paramKey={sortBy.paramKey ?? "sortBy"}
							prefixLabel={sortBy.prefixLabel ?? "Sort by"}
						/>
					)}
					{actions}
				</div>
			)}
		</div>
	);
}
