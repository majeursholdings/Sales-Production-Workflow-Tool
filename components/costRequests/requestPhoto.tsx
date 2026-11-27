"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { PartRow, RequestPart } from "@/lib/costRequests";

/** What a pin needs: a cost request's PartRow or a custom design's row both fit. */
type PinRow = Pick<PartRow, "num" | "name" | "tone"> & { part: Pick<RequestPart, "id" | "pin"> };

/** Pin and number colours by how a part stands: matched, unsure, missing, substituted, removed. */
export const toneClass: Record<PartRow["tone"], string> = {
	"": "bg-inverse text-fg-inverse",
	unsure: "bg-warning-fg text-surface",
	miss: "bg-danger-fg text-surface",
	sub: "bg-success-fg text-surface",
	none: "border border-line bg-subtle text-fg-secondary",
};

/** The client's photo with a numbered pin on each part the agent found in it. */
export default function RequestPhoto({
	image,
	rows,
	focus,
	onFocus,
	children,
}: {
	image: { src: string; alt: string };
	rows: PinRow[];
	/** Part id that's highlighted, on the photo and in the table. */
	focus: string | null;
	onFocus: (partId: string | null) => void;
	/** Drawn over the photo, e.g. a scanning overlay while the agent works. */
	children?: ReactNode;
}) {
	return (
		<div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-line bg-subtle">
			<Image src={image.src} alt={image.alt} fill unoptimized className="object-cover" />
			{rows
				.filter((r) => r.part.pin)
				.map((r) => {
					const [x, y] = r.part.pin as [number, number];
					const on = focus === r.part.id;
					return (
						<button
							key={r.part.id}
							type="button"
							aria-pressed={on}
							aria-label={`${r.num}: ${r.name}`}
							title={r.name}
							onClick={() => onFocus(on ? null : r.part.id)}
							style={{ left: `${x}%`, top: `${y}%` }}
							className={cn(
								"absolute grid size-7 -translate-x-1/2 -translate-y-1/2 cursor-pointer place-items-center rounded-full border-2 border-surface text-small font-bold shadow-[0_1px_4px_rgb(33_29_26/0.35)]",
								// a 44px hit area around the 28px pin
								"after:absolute after:-inset-2 after:rounded-full",
								"focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus",
								"aria-pressed:shadow-[0_0_0_4px_var(--bg-surface),0_0_0_7px_var(--accent-solid)]",
								toneClass[r.tone],
							)}
						>
							{r.num}
						</button>
					);
				})}
			{children}
		</div>
	);
}
