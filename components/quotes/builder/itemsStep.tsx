"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronDown, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/common/badge";
import { Button, LinkButton } from "@/components/common/buttons";
import { Card } from "@/components/common/card";
import { ConfirmDialog } from "@/components/common/modal";
import { SegmentedControl } from "@/components/common/segmented-control";
import PageWrapper from "@/components/layout/pageWrapper";
import { Table } from "@/components/tables";
import { cn } from "@/lib/cn";
import {
	MAX_GENERAL_DISCOUNT,
	PROJECT_COST_OPTIONS,
	formatMoney,
	priceQuote,
	wholeNaira,
	type PricedItem,
} from "@/lib/quoteBuilder";
import { updateDraft, useQuoteDraft } from "@/lib/quoteDraft";
import BuilderHeader from "./builderHeader";
import Stepper from "./stepper";
import SummaryCard from "./summaryCard";

const fieldClass =
	"h-10 w-full rounded-md border border-line-control bg-surface px-3 text-fg outline-none placeholder:text-fg-tertiary focus:border-focus focus:ring-1 focus:ring-focus";
const wrap = "overflow-x-auto rounded-md border border-line";

function BreakdownRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
	return (
		<div className={cn("flex justify-between gap-3 text-body", bold && "font-bold")}>
			<span className={bold ? "text-fg" : "text-fg-secondary"}>{label}</span>
			<span className="tabular">{value}</span>
		</div>
	);
}

export default function ItemsStep({ createdBy }: { createdBy: string }) {
	const router = useRouter();
	const draft = useQuoteDraft();
	const pricing = priceQuote(draft);
	const { client, currency } = draft;
	const isTrade = client?.type === "Trade";

	const [removing, setRemoving] = useState<{
		key: string;
		part: string;
		item: string;
		line: number;
	} | null>(null);
	const [costKind, setCostKind] = useState("site");
	const [costAmount, setCostAmount] = useState(String(PROJECT_COST_OPTIONS.site.amount));
	const [costNote, setCostNote] = useState("");

	const setQty = (item: PricedItem, qty: number) =>
		updateDraft((d) => ({ qty: { ...d.qty, [item.id]: Math.max(1, qty) } }));
	const setHours = (key: string, hours: number) =>
		updateDraft((d) => ({ hours: { ...d.hours, [key]: Math.max(0, hours) } }));

	const addCost = () => {
		const option = PROJECT_COST_OPTIONS[costKind];
		const amount = Number(costAmount.replace(/[^0-9.]/g, "")) || 0;
		if (!amount) return;
		const name =
			costKind === "third" && costNote.trim()
				? `Third-party work: ${costNote.trim()}`
				: option.name;
		updateDraft((d) => ({
			projectCosts: [
				...d.projectCosts,
				{ id: crypto.randomUUID(), name, type: option.type, per: option.per, amount },
			],
		}));
		setCostNote("");
	};

	const disabledAdd = {
		disabled: true,
		title: "Needs the furniture catalogue, which isn't built yet",
	};

	return (
		<PageWrapper>
			<BuilderHeader
				step={2}
				createdBy={createdBy}
				actions={
					<>
						<Button
							onClick={() => {
								toast.success("Draft kept for this session.");
								router.push("/quotes");
							}}
						>
							Save draft
						</Button>
						<Button
							variant="primary"
							disabled={!client}
							onClick={() => router.push("/quotes/new/review")}
						>
							Review &amp; send
							<ArrowRight />
						</Button>
					</>
				}
			/>

			<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
				<div className="flex min-w-0 flex-col gap-6">
					<Card className="flex-row flex-wrap items-center gap-4">
						<div className="flex min-w-0 flex-1 basis-70 flex-col gap-1">
							<span className="text-overline text-fg-tertiary uppercase">Client</span>
							{client ? (
								<>
									<strong className="text-h3">{client.name}</strong>
									<span className="text-small text-fg-secondary">
										{client.contact}
										{client.location ? ` · Delivery: ${client.location}` : ""}
									</span>
								</>
							) : (
								<span className="text-body text-fg-secondary">
									No client chosen yet.
								</span>
							)}
						</div>
						<LinkButton href="/quotes/new" size="sm">
							{client ? "Change client" : "Choose client"}
						</LinkButton>
					</Card>

					{pricing.items.map((item) => {
						const open = draft.open[item.id] ?? false;
						return (
							<Card key={item.id} className="gap-4">
								<div className="flex flex-wrap items-center gap-4">
									<Button
										variant="ghost"
										size="sm"
										icon
										aria-expanded={open}
										aria-label={`${open ? "Collapse" : "Expand"} ${item.name}`}
										title={`${open ? "Collapse" : "Expand"} ${item.name}`}
										onClick={() =>
											updateDraft((d) => ({
												open: { ...d.open, [item.id]: !open },
											}))
										}
									>
										<ChevronDown
											className={cn(
												"transition-transform",
												!open && "-rotate-90",
											)}
										/>
									</Button>
									<div className="flex min-w-0 flex-1 basis-55 flex-col gap-1">
										<h2>{item.name}</h2>
										<span className="text-small text-fg-tertiary">
											{item.meta} · {item.parts.length} parts,{" "}
											{item.labourHours} production hours
										</span>
									</div>
									<Stepper
										value={item.qty}
										min={1}
										onChange={(n) => setQty(item, n)}
										decreaseLabel={`Decrease ${item.name} quantity`}
										increaseLabel={`Increase ${item.name} quantity`}
									/>
									<div className="flex min-w-50 flex-col items-end gap-0.5">
										<strong className="text-h3 tabular">
											{formatMoney(item.price, currency)}
										</strong>
										<span className="text-right text-small text-fg-tertiary">
											Cost{" "}
											{wholeNaira(item.unitCostWithContingency * item.qty)}{" "}
											incl. 5% contingency · markup{" "}
											{Math.round(item.markup * 100)}% (cap{" "}
											{Math.round(item.markupCap * 100)}%)
										</span>
									</div>
								</div>

								{open && (
									<>
										<div className={wrap}>
											<Table className="min-w-160">
												<thead>
													<tr>
														<th scope="col">Part</th>
														<th scope="col">Spec</th>
														<th scope="col" className="text-end">
															Qty
														</th>
														<th scope="col" className="text-end">
															Unit cost
														</th>
														<th scope="col" className="text-end">
															Line cost
														</th>
														<th scope="col" className="w-10">
															<span className="sr-only">Remove</span>
														</th>
													</tr>
												</thead>
												<tbody>
													{item.parts.map((p) => (
														<tr key={p.key}>
															<td>
																<span className="flex flex-col">
																	<span className="font-bold text-fg">
																		{p.name}
																	</span>
																	<span className="text-small text-fg-tertiary">
																		{p.detail}
																	</span>
																</span>
															</td>
															<td>{p.spec}</td>
															<td className="text-end font-bold text-fg tabular">
																{p.qty}
															</td>
															<td className="text-end whitespace-nowrap tabular">
																{wholeNaira(p.unit)}
															</td>
															<td className="text-end font-bold whitespace-nowrap text-fg tabular">
																{wholeNaira(p.line)}
															</td>
															<td>
																<Button
																	variant="ghost"
																	size="sm"
																	icon
																	aria-label={`Remove ${p.name} from ${item.name}`}
																	title="Remove part"
																	className="hover:bg-danger-subtle hover:text-danger-fg"
																	onClick={() =>
																		setRemoving({
																			key: p.key,
																			part: p.name,
																			item: item.name.toLowerCase(),
																			line: p.line,
																		})
																	}
																>
																	<Trash2 />
																</Button>
															</td>
														</tr>
													))}
												</tbody>
											</Table>
										</div>

										<div className={wrap}>
											<Table className="min-w-140">
												<thead>
													<tr>
														<th scope="col">Labour and machine time</th>
														<th scope="col">Hours per piece</th>
														<th scope="col" className="text-end">
															Rate
														</th>
														<th scope="col" className="text-end">
															Cost
														</th>
													</tr>
												</thead>
												<tbody>
													{[
														...item.labour.map((h) => ({
															...h,
															kind: "Labour",
														})),
														...item.machines.map((h) => ({
															...h,
															kind: "Machine",
														})),
													].map((h) => (
														<tr key={`${h.kind}-${h.key}`}>
															<td>
																<span className="flex flex-col">
																	<span className="font-bold text-fg">
																		{h.name}
																	</span>
																	<span className="text-small text-fg-tertiary">
																		{h.kind}
																	</span>
																</span>
															</td>
															<td>
																<span className="inline-flex items-center gap-2">
																	<Stepper
																		value={h.hours}
																		onChange={(n) =>
																			setHours(h.key, n)
																		}
																		decreaseLabel={`Fewer ${h.name.toLowerCase()} hours on the ${item.name.toLowerCase()}`}
																		increaseLabel={`More ${h.name.toLowerCase()} hours on the ${item.name.toLowerCase()}`}
																	/>
																	{h.hours !== h.defaultHours && (
																		<Badge variant="info">
																			Was {h.defaultHours}
																		</Badge>
																	)}
																</span>
															</td>
															<td className="text-end whitespace-nowrap tabular">
																{wholeNaira(h.rate)}/h
															</td>
															<td className="text-end font-bold whitespace-nowrap text-fg tabular">
																{wholeNaira(h.cost)}
															</td>
														</tr>
													))}
												</tbody>
											</Table>
										</div>

										<div className="flex flex-wrap items-start gap-4">
											<div className="flex flex-wrap gap-2">
												<Button size="sm" {...disabledAdd}>
													<Plus />
													Add part
												</Button>
												<Button variant="ghost" size="sm" {...disabledAdd}>
													Custom addition from photo
												</Button>
											</div>
											<div className="ml-auto flex w-full max-w-90 flex-col gap-1 rounded-md bg-page p-3">
												<BreakdownRow
													label="Parts"
													value={wholeNaira(item.partsCost)}
												/>
												<BreakdownRow
													label={`Labour (${item.labourHours} hours)`}
													value={wholeNaira(item.labourCost)}
												/>
												<BreakdownRow
													label={`Machines (${item.machineHours} hours)`}
													value={wholeNaira(item.machineCost)}
												/>
												<BreakdownRow
													label={`Workshop overhead (${item.labourHours} h × ₦3,673)`}
													value={wholeNaira(item.overhead)}
												/>
												<BreakdownRow
													label="Protective wrapping"
													value={wholeNaira(item.wrapping)}
												/>
												<div className="my-1 h-px bg-line" />
												<BreakdownRow
													bold
													label="Cost per piece"
													value={wholeNaira(item.unitCost)}
												/>
											</div>
										</div>
									</>
								)}
							</Card>
						);
					})}

					<Card flush className="overflow-hidden">
						<div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
							<h2 className="flex-1">Project costs</h2>
							<span className="text-small text-fg-tertiary">
								Charged once for this quote, at cost
							</span>
						</div>
						<ul className="flex flex-col px-5">
							{draft.projectCosts.map((c) => (
								<li
									key={c.id}
									className="flex items-center gap-3 border-t border-line py-3 first:border-t-0"
								>
									<span className="flex min-w-0 flex-1 flex-col">
										<strong className="text-fg">{c.name}</strong>
										<span className="text-small text-fg-tertiary">
											{c.type} · {c.per}
										</span>
									</span>
									<strong className="text-fg tabular">
										{wholeNaira(c.amount)}
									</strong>
									<Button
										variant="ghost"
										size="sm"
										icon
										aria-label={`Remove ${c.name}`}
										title="Remove"
										className="hover:bg-danger-subtle hover:text-danger-fg"
										onClick={() =>
											updateDraft((d) => ({
												projectCosts: d.projectCosts.filter(
													(x) => x.id !== c.id,
												),
											}))
										}
									>
										<Trash2 />
									</Button>
								</li>
							))}
							{draft.projectCosts.length === 0 && (
								<li className="py-3 text-body text-fg-secondary">
									No project costs added.
								</li>
							)}
						</ul>
						<div className="flex flex-wrap items-end gap-3 border-t border-line px-5 py-4">
							<label className="flex min-w-55 flex-1 basis-55 flex-col gap-2">
								<span className="text-body font-bold">Add a cost</span>
								<select
									value={costKind}
									onChange={(e) => {
										setCostKind(e.target.value);
										setCostAmount(
											PROJECT_COST_OPTIONS[e.target.value].amount
												? String(
														PROJECT_COST_OPTIONS[e.target.value].amount,
													)
												: "",
										);
									}}
									className={fieldClass}
								>
									{Object.entries(PROJECT_COST_OPTIONS).map(([key, o]) => (
										<option key={key} value={key}>
											{o.name}
											{o.amount
												? ` (${wholeNaira(o.amount)})`
												: ", enter amount"}
										</option>
									))}
								</select>
							</label>
							{costKind === "third" && (
								<label className="flex min-w-50 flex-1 basis-50 flex-col gap-2">
									<span className="text-body font-bold">What and who</span>
									<input
										value={costNote}
										onChange={(e) => setCostNote(e.target.value)}
										placeholder="e.g. Glass top, Lekki Glass Works"
										className={fieldClass}
									/>
								</label>
							)}
							<label className="flex w-40 flex-col gap-2">
								<span className="text-body font-bold">Amount (₦)</span>
								<input
									value={costAmount}
									onChange={(e) => setCostAmount(e.target.value)}
									inputMode="decimal"
									className={fieldClass}
								/>
							</label>
							<Button onClick={addCost}>Add cost</Button>
						</div>
						<p className="px-5 pb-4 text-small text-fg-tertiary">
							Delivery, installation, site visits and third-party work. Standard
							amounts come from Cost rates; change them if this project is different.
						</p>
					</Card>

					<div className="flex flex-wrap gap-3">
						<Button {...disabledAdd}>
							<Plus />
							Add furniture item
						</Button>
						<Button
							{...{
								disabled: true,
								title: "Needs the custom design flow, which isn't built yet",
							}}
						>
							<Plus />
							Custom design from photo
						</Button>
					</div>
				</div>

				<aside aria-label="Quote totals" className="flex min-w-0 flex-col gap-6">
					<SummaryCard pricing={pricing} currency={currency} />
					<Card>
						<h2>Discount</h2>
						{isTrade ? (
							<div className="flex flex-col gap-1 text-body">
								<span>
									<strong>
										Trade program: {client?.tier.split(" · ")[0] ?? "Starter"}{" "}
										tier
									</strong>
									{client?.tier ? ` · ${client.tier.split(" · ")[1] ?? ""}` : ""}
								</span>
								<span className="text-small text-fg-tertiary">
									{client?.company || client?.name} gets its trade tier discount
									only. The general discount can&apos;t be added on top for trade
									clients.
								</span>
							</div>
						) : (
							<>
								<SegmentedControl<string>
									label="General discount"
									value={String(draft.discount)}
									onChange={(v) => updateDraft({ discount: Number(v) })}
									options={Array.from(
										{ length: MAX_GENERAL_DISCOUNT + 1 },
										(_, p) => ({
											value: String(p),
											label: p ? `${p}%` : "None",
										}),
									)}
									className="self-start"
								/>
								{draft.discount > 0 && (
									<label className="flex flex-col gap-2">
										<span className="text-body font-bold">Reason</span>
										<input
											value={draft.discountReason}
											onChange={(e) =>
												updateDraft({ discountReason: e.target.value })
											}
											placeholder="Why this client gets a discount"
											className={fieldClass}
										/>
										<small className="text-small text-fg-tertiary">
											Shown to Accounting and the MD/GM, not on the
											client&apos;s quote.
										</small>
									</label>
								)}
								<p className="text-small text-fg-tertiary">
									General discount at your discretion, up to{" "}
									{MAX_GENERAL_DISCOUNT}% of the price before VAT. The MD or GM
									sets the limit.
								</p>
							</>
						)}
					</Card>
					<p className="text-small text-fg-tertiary">
						Hours start from each furniture type; change them here if this project needs
						more or less time. Rates come from{" "}
						<Link href="/cost-rates">Cost rates</Link>, set by Accounting.
					</p>
				</aside>
			</div>

			{removing && (
				<ConfirmDialog
					title={`Remove ${removing.part} from the ${removing.item}?`}
					confirmLabel="Remove part"
					onCancel={() => setRemoving(null)}
					onConfirm={() => {
						updateDraft((d) => ({ removedParts: [...d.removedParts, removing.key] }));
						setRemoving(null);
					}}
				>
					This only changes this quote. The cost drops by {wholeNaira(removing.line)} per
					piece and the price is recalculated. The furniture type template stays as it is.
				</ConfirmDialog>
			)}
		</PageWrapper>
	);
}
