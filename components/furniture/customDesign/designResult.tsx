"use client";

import { useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import { Badge } from "@/components/common/badge";
import { Card } from "@/components/common/card";
import { Confidence } from "@/components/costRequests/partsTable";
import RequestPhoto, { toneClass } from "@/components/costRequests/requestPhoto";
import type { FormFieldConfig } from "@/components/forms/types";
import MaterialThumb from "@/components/suppliers/materialThumb";
import { cn } from "@/lib/cn";
import type { AgentRules } from "@/lib/companySettings";
import { naira } from "@/lib/costRequests";
import {
	ASK_PROCUREMENT,
	type DesignAssessment,
	type DesignResult,
	type DesignRow,
} from "@/lib/customDesign";

/** Renders one field of the flow's form (the choice for a part that isn't in inventory). */
export type RenderField = (config: FormFieldConfig) => ReactNode;

/** The agent's parts list: the photo with numbered pins beside the parts, what needs checking and the price. */
export default function DesignResultView({
	result,
	assessment,
	rules,
	renderField,
}: {
	result: DesignResult;
	assessment: DesignAssessment;
	rules: AgentRules;
	renderField: RenderField;
}) {
	const [focus, setFocus] = useState<string | null>(null);
	const [activeImage, setActiveImage] = useState(0);
	const { rows, reasons } = assessment;
	const image = result.images[activeImage] ?? result.images[0];

	return (
		<div className="flex flex-wrap items-start gap-6">
			<div className="flex max-w-105 min-w-0 flex-[1_1_320px] flex-col gap-3">
				{image && (
					<RequestPhoto
						image={image}
						rows={activeImage === 0 ? rows : []}
						focus={focus}
						onFocus={setFocus}
					/>
				)}
				{result.images.length > 1 && (
					<ul className="flex flex-wrap gap-2" aria-label="Photos of the design">
						{result.images.map((img, i) => (
							<li key={img.src}>
								<button
									type="button"
									onClick={() => setActiveImage(i)}
									aria-current={i === activeImage ? "true" : undefined}
									aria-label={`Show photo ${i + 1}`}
									className={cn(
										"block cursor-pointer overflow-hidden rounded-md border-2",
										i === activeImage ? "border-accent" : "border-line",
									)}
								>
									{/* eslint-disable-next-line @next/next/no-img-element -- served from authenticated /api/storage route */}
									<img src={img.src} alt="" className="size-12 object-cover" />
								</button>
							</li>
						))}
					</ul>
				)}
				<p className="text-small text-fg-secondary">
					Photo {activeImage + 1} of {result.images.length}
					{activeImage === 0
						? ". Select a number to find the part."
						: ". Pins are on photo 1."}
				</p>
				<dl className="grid grid-cols-2 gap-3 text-body">
					<div className="flex flex-col gap-0.5">
						<dt className="text-overline text-fg-tertiary uppercase">For</dt>
						<dd>{result.target}</dd>
					</div>
					<div className="flex flex-col gap-0.5">
						<dt className="text-overline text-fg-tertiary uppercase">Size</dt>
						<dd>{result.size || "Not given"}</dd>
					</div>
					{result.description && (
						<div className="col-span-2 flex flex-col gap-0.5">
							<dt className="text-overline text-fg-tertiary uppercase">
								Description
							</dt>
							<dd className="text-fg-secondary">{result.description}</dd>
						</div>
					)}
				</dl>
			</div>

			<div className="flex min-w-0 flex-[999_1_420px] flex-col gap-4">
				{assessment.ready ? (
					<div
						role="status"
						className="flex items-start gap-3 rounded-md border border-success-line bg-success-subtle p-3 text-body"
					>
						<Check
							aria-hidden="true"
							className="mt-0.5 size-5 shrink-0 text-success-fg"
						/>
						<span>
							<b>Ready to add.</b> Every part is in inventory and the agent is at
							least {rules.threshold}% sure of each one, so this can go straight on
							the quote.
						</span>
					</div>
				) : (
					<div
						role="status"
						className="flex flex-col gap-2 rounded-md border border-warning-line bg-warning-subtle p-3 text-body"
					>
						<b>
							{reasons.length > 0
								? `Procurement will check ${reasons.length === 1 ? "1 thing" : `${reasons.length} things`} before this is priced`
								: "Procurement checks every custom design before it's priced"}
						</b>
						{reasons.length > 0 && (
							<ul className="flex list-disc flex-col gap-1 ps-5">
								{reasons.map((r) => (
									<li key={r}>{r}</li>
								))}
							</ul>
						)}
						<span className="text-small text-fg-secondary">
							{assessment.alwaysReview
								? "The MD or GM has set every custom design to go to procurement first. They can change this in Settings."
								: `Lines go straight on the quote only when every part is in inventory and the agent is at least ${rules.threshold}% sure of each. The MD or GM sets this in Settings.`}
						</span>
					</div>
				)}

				<section aria-labelledby="design-parts" className="flex flex-col gap-1">
					<div className="flex flex-wrap items-baseline gap-2">
						<h2 id="design-parts" className="flex-1">
							Parts the agent picked
						</h2>
						<span className="text-small text-fg-secondary">
							{rows.length} part{rows.length === 1 ? "" : "s"} · per piece
						</span>
					</div>
					<ul className="flex flex-col">
						{rows.map((row) => (
							<PartItem
								key={row.part.id}
								row={row}
								rules={rules}
								focused={focus === row.part.id}
								onFocus={() => setFocus(focus === row.part.id ? null : row.part.id)}
								renderField={renderField}
							/>
						))}
					</ul>
				</section>

				<Card aria-labelledby="design-price" className="gap-2 bg-page">
					<h2 id="design-price">Price per piece</h2>
					<PriceRow label="Parts and labour" value={naira(assessment.cost)} />
					{assessment.pending.length > 0 && (
						<PriceRow
							label={assessment.pending.join(", ")}
							value={<span className="text-warning-fg">Cost from procurement</span>}
						/>
					)}
					<PriceRow
						label={`Markup (${result.markupPercent}%${result.markupCategory ? `, ${result.markupCategory}` : ""}, set by Accounting)`}
						value={naira(assessment.markup)}
					/>
					<hr className="border-line" />
					<PriceRow
						bold
						label={
							result.scope === "addition" && result.targetName
								? `Adds to the ${result.targetName} price`
								: "Price per piece, before VAT"
						}
						value={`${naira(assessment.price)}${assessment.pending.length ? " so far" : ""}`}
					/>
					{result.labourNote && (
						<p className="text-small text-fg-secondary">{result.labourNote}</p>
					)}
				</Card>
			</div>
		</div>
	);
}

function PriceRow({ label, value, bold }: { label: string; value: ReactNode; bold?: boolean }) {
	return (
		<div className={cn("flex justify-between gap-3 text-body", bold && "font-bold")}>
			<span className={bold ? "text-fg" : "text-fg-secondary"}>{label}</span>
			<span className="text-end tabular">{value}</span>
		</div>
	);
}

/** One part: its number on the photo, how sure the agent is, its cost and, when it isn't stocked, what to do. */
function PartItem({
	row,
	rules,
	focused,
	onFocus,
	renderField,
}: {
	row: DesignRow;
	rules: AgentRules;
	focused: boolean;
	onFocus: () => void;
	renderField: RenderField;
}) {
	const { part } = row;
	const unpriced = row.line === null;
	const subs = rules.suggestSubstitutes ? (part.substitutes ?? []) : [];
	const note = row.sub ? null : (part.doubt ?? part.note);

	return (
		<li
			className={cn(
				"grid grid-cols-[28px_40px_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 rounded-md border-t border-line px-2 py-3 first:border-t-0",
				focused && "bg-accent-subtle",
			)}
		>
			<button
				type="button"
				aria-pressed={focused}
				aria-label={
					part.pin
						? `Show part ${row.num} on the photo`
						: `Part ${row.num} isn't visible in the photo`
				}
				onClick={onFocus}
				className={cn(
					"grid size-7 cursor-pointer place-items-center rounded-full text-small font-bold",
					"focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus",
					toneClass[row.tone],
				)}
			>
				{row.num}
			</button>
			{row.sku ? (
				<MaterialThumb sku={row.sku} />
			) : (
				<span
					aria-hidden="true"
					className="size-10 rounded-md border border-line bg-subtle"
				/>
			)}
			<div className="flex min-w-0 flex-col gap-0.5">
				<b className="text-body">{row.name}</b>
				<span className="text-small text-fg-secondary">
					{part.use ? `${part.use} · ` : ""}
					{row.skuLine}
				</span>
				<div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
					<Confidence value={part.confidence} threshold={rules.threshold} />
					{row.badge && <Badge variant={row.badge.tone}>{row.badge.label}</Badge>}
				</div>
				{note && <span className="text-small text-fg-secondary">{note}</span>}
			</div>
			<div className="flex flex-col items-end gap-0.5 text-end">
				<b className="text-body tabular">
					{unpriced ? "To be priced" : naira(row.line ?? 0)}
				</b>
				<span className="text-small text-fg-secondary tabular">
					{row.qty} {row.unit}
					{row.unitCost !== null && ` × ${naira(row.unitCost)}`}
				</span>
			</div>

			{row.missing && (
				<div className="col-span-full mt-2 flex flex-col gap-2 rounded-md border border-line bg-page p-3 sm:col-start-3">
					{subs.length > 0 ? (
						renderField({
							name: `choices.${part.id}`,
							type: "radio",
							appearance: "cards",
							label: "Not in inventory. What should happen?",
							options: [
								...subs.map((s) => ({
									value: s.id,
									label: `Use ${s.name}`,
									description: s.why,
									aside: (
										<span className="flex flex-col items-end tabular">
											<b>{naira(s.qty * s.unitCost)}</b>
											<span className="text-small text-fg-secondary">
												{s.qty} {part.substituteUnits?.[s.id] ?? part.unit}{" "}
												× {naira(s.unitCost)}
											</span>
										</span>
									),
								})),
								{
									value: ASK_PROCUREMENT,
									label: "Ask procurement to add it",
									description:
										"They price it and add it to inventory, or tell you they can't source it.",
								},
							],
						})
					) : (
						<p className="text-body">
							<b>Not in inventory.</b> Procurement will price it and add it to
							inventory, or tell you they can&apos;t source it.
						</p>
					)}
				</div>
			)}
		</li>
	);
}
