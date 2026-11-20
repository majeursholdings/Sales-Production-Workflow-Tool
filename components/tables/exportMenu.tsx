"use client";

import { useState } from "react";
import { ChevronDown, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { buttonClasses } from "@/components/common/buttons";
import { Menu, MenuItem } from "./menu";
import { EXPORT_FORMATS, type ExportFormat } from "./exportRows";

// ─────────────────────────────────────────────────────────────────────────────
// ExportMenu: the toolbar's "Export ⌄" button, with a choice of CSV, Excel,
// OpenDocument and PDF. `onExport` loads the rows and saves the file (see
// exportRows); the button shows it's working until that's done, and a
// failure is a toast.
// ─────────────────────────────────────────────────────────────────────────────

export interface ExportMenuProps {
	onExport: (format: ExportFormat) => Promise<void>;
	label?: string;
	disabled?: boolean;
	/** Leave some formats out of the menu. */
	formats?: ExportFormat[];
}

export function ExportMenu({ onExport, label = "Export", disabled = false, formats }: ExportMenuProps) {
	const [busy, setBusy] = useState(false);
	const options = EXPORT_FORMATS.filter((option) => !formats || formats.includes(option.value));

	const run = async (format: ExportFormat) => {
		setBusy(true);
		try {
			await onExport(format);
		} catch (err) {
			toast.error(err instanceof Error && err.message ? err.message : "Couldn't export the table. Please try again.");
		} finally {
			setBusy(false);
		}
	};

	return (
		<Menu
			label={label}
			disabled={disabled || busy}
			triggerClassName={buttonClasses({ variant: "secondary" })}
			trigger={
				<>
					{busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />}
					{busy ? "Exporting…" : label}
					<ChevronDown className="size-4!" aria-hidden="true" />
				</>
			}
		>
			{options.map((option) => (
				<MenuItem key={option.value} onSelect={() => void run(option.value)}>
					{option.label}
				</MenuItem>
			))}
		</Menu>
	);
}
