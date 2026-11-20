"use client";

import { useContext, useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import { Search } from "lucide-react";
import { TableIdContext, useTableParam } from "./tableContext";

// ─────────────────────────────────────────────────────────────────────────────
// SearchInput — the toolbar's search box: icon + borderless input in a bordered shell.
// ─────────────────────────────────────────────────────────────────────────────

export interface SearchInputProps {
	placeholder?: string;
	paramKey?: string;
}

export function SearchInput({ placeholder = "Search…", paramKey = "search" }: SearchInputProps) {
	const tableId = useContext(TableIdContext);
	const { getParam, setParam } = useTableParam(tableId);
	const urlValue = getParam(paramKey) ?? "";
	// What's typed shows at once; the address (which every table and filter
	// on the page reads) follows a moment after typing stops, so each
	// keystroke doesn't re-render the page
	const [value, setValue] = useState(urlValue);
	const [syncedUrlValue, setSyncedUrlValue] = useState(urlValue);
	if (urlValue !== syncedUrlValue) {
		// Changed from elsewhere (back button, a link, "clear filters"): show that
		setSyncedUrlValue(urlValue);
		setValue(urlValue);
	}
	const writeToUrl = useDebouncedCallback((next: string) => setParam(paramKey, next), 250);

	return (
		<label className="flex h-10 max-w-full min-w-55 flex-1 basis-55 items-center gap-2 rounded-md border border-line-control bg-surface px-3 focus-within:border-focus focus-within:ring-1 focus-within:ring-focus sm:max-w-sm">
			<Search aria-hidden="true" className="size-4 shrink-0 text-fg-tertiary" />
			<span className="sr-only">{placeholder}</span>
			<input
				type="search"
				value={value}
				onChange={(e) => {
					setValue(e.target.value);
					writeToUrl(e.target.value);
				}}
				placeholder={placeholder}
				className="min-w-0 flex-1 bg-transparent text-fg outline-none placeholder:text-fg-tertiary"
			/>
		</label>
	);
}
