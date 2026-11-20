"use client";

import { useContext } from "react";
import { TableIdContext, useTableParam } from "./tableContext";
import { OptionsMenu } from "./optionsMenu";
import type { SelectFilterItem } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// SelectFilter
// ─────────────────────────────────────────────────────────────────────────────

export interface SelectFilterProps {
	title: string;
	items: SelectFilterItem[];
	paramKey: string;
	/**
	 * Label shown beside the select instead of `title`, with the reset
	 * option reading `placeholder` — e.g. "Sort by" / "Default".
	 * Omit for a regular filter, labelled by `title` with an "All" option.
	 */
	prefixLabel?: string;
	/** Reset option text when prefixLabel is set. Defaults to "All". */
	placeholder?: string;
}

export function SelectFilter({
	title,
	items,
	paramKey,
	prefixLabel,
	placeholder = "All",
}: SelectFilterProps) {
	const tableId = useContext(TableIdContext);
	const { getParam, setParam } = useTableParam(tableId);

	return (
		<OptionsMenu
			items={items}
			value={getParam(paramKey) ?? ""}
			onChange={(value) => setParam(paramKey, value)}
			label={(prefixLabel ?? title).replace(/:\s*$/, "")}
			resetLabel={prefixLabel ? placeholder : "All"}
		/>
	);
}
