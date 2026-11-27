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
import { Input, Select } from "@/components/forms/input";
import PageWrapper from "@/components/layout/pageWrapper";
import { Table } from "@/components/tables";
import { cn } from "@/lib/cn";
import {
	formatMoney,
	priceQuote,
	ratePercent,
	wholeNaira,
	type PricedItem,
	type QuoteBuilderSetup,
} from "@/lib/quoteBuilder";
import { resetDraft, updateDraft, useQuoteDraft } from "@/lib/quoteDraft";
import AddItemDrawer from "./addItemDrawer";
import BuilderHeader from "./builderHeader";
import Stepper from "./stepper";
import SummaryCard from "./summaryCard";
import { cannotSave, useSaveQuote } from "./useSaveQuote";

const CUSTOM_COST = "__custom";
const wrap = "overflow-x-auto rounded-md border border-line";

function BreakdownRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
	return (
		<div className={cn("flex justify-between gap-3 text-body", bold && "font-bold")}>
			<span className={bold ? "text-fg" : "text-fg-secondary"}>{label}</span>
			<span className="tabular">{value}</span>
		</div>
	);
}

export default function ItemsStep({
	createdBy,
	setup,
}: {
	createdBy: string;
	setup: QuoteBuilderSetup;
}) {
	const router = useRouter();
	const draft = useQuoteDraft();
	const { catalog, rates, projectCostOptions } = setup;
	const pricing = priceQuote(draft, catalog, rates);
	const { client, currency } = draft;
	const isTrade = client?.type === "Trade";
	const money = (n: number) => formatMoney(n, currency, rates.usdRate);
	const { save, saving } = useSaveQuote();
	const blocked = cannotSave(draft);
	const [adding, setAdding] = useState(false);

	const [removing, setRemoving] = useState<{
		key: string;
		part: string;
		item: string;
		line: number;
	} | null>(null);
	const [costKind, setCostKind] = useState(projectCostOptions[0]?.id ?? CUSTOM_COST);
	const [costAmount, setCostAmount] = useState(
		projectCostOptions[0]?.amount ? String(projectCostOptions[0].amount) : "",
	);
	const [costNote, setCostNote] = useState("");
	const costOption = projectCostOptions.find((o) => o.id === costKind);

	const setQty = (item: PricedItem, qty: number) =>
		updateDraft((d) => ({ qty: { ...d.qty, [item.id]: Math.max(1, qty) } }));
	const setHours = (key: string, hours: number) =>
		updateDraft((d) => ({ hours: { ...d.hours, [key]: Math.max(0, hours) } }));

	const addCost = () => {
		const amount = Number(costAmount.replace(/[^0-9.]/g, "")) || 0;
		if (!amount) {
			toast.error("Enter an amount greater than ₦0.");
			return;
		}
		const note = costNote.trim();
		if (!costOption && !note) {
			toast.error("Say what the cost is for.");
			return;
		}
		const name = costOption ? (note ? `${costOption.name}: ${note}` : costOption.name) : note;
		updateDraft((d) => ({
			projectCosts: [
				...d.projectCosts,
				{
					id: crypto.randomUUID(),
					name,
					type: costOption?.type ?? "Direct",
					per: costOption?.per ?? "Per project",
					amount,
				},
			],
		}));
		setCostNote("");
	};

	const addItem = (id: string) => {
		updateDraft((d) => ({
			items: d.items.includes(id) ? d.items : [...d.items, id],
			qty: { ...d.qty, [id]: d.qty[id] ?? 1 },
			open: { ...d.open, [id]: true },
		}));
		setAdding(false);
	};

	const removeItem = (id: string) =>
		updateDraft((d) => ({
			items: d.items.filter((x) => x !== id),
			removedParts: d.removedParts.filter((k) => !k.startsWith(`${id}|`)),
			hours: Object.fromEntries(
				Object.entries(d.hours).filter(([k]) => !k.startsWith(`${id}|`)),
			),
		}));

	const notBuilt = {
		disabled: true,
		title: "Changing parts on a single quote isn't built yet",
	};

	return (
		<PageWrapper>
			<BuilderHeader
				step={2}
				createdBy={createdBy}
				header={draft.savedHeader ?? setup.header}
				saved={draft.quoteNumber !== null}
				sent={draft.sent}
				actions={
					<>
						<Button
							disabled={blocked !== null || saving}
							title={blocked ?? undefined}
							onClick={() =>
								save(draft, false, () => {
									resetDraft();
									router.push("/quotes");
								})
							}
						>
							{saving ? "Saving…" : "Save draft"}
						</Button>
						<Button
							variant="primary"
							disabled={!client || pricing.items.length === 0}
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

					{pricing.missing.length > 0 && (
						<div
							role="alert"
							className="flex flex-wrap items-center gap-3 rounded-md border border-warning-line bg-warning-subtle px-4 py-3 text-body text-fg"
						>
							<span className="min-w-0 flex-1">
								{pricing.missing.length === 1
									? "A furniture type on this quote was removed or unpublished."
									: `${pricing.missing.length} furniture types on this quote were removed or unpublished.`}{" "}
								Take {pricing.missing.length === 1 ? "it" : "them"} off to save.
							</span>
							<Button
								size="sm"
								onClick={() =>
									updateDraft((d) => ({
										items: d.items.filter((id) => !pricing.missing.includes(id)),
									}))
								}
							>
								Take off
							</Button>
						</div>
					)}

					{pricing.items.length === 0 && (
						<Card className="items-start gap-3">
							<h2>No furniture items yet</h2>
							<p className="text-body text-fg-secondary">
								{catalog.length === 0
									? "No furniture types are published yet. Once the MD or GM publishes one in Furniture types, it can be added here."
									: "Add a furniture type; its standard parts and hours fill in, and you can adjust them for this quote."}
							</p>
							{catalog.length > 0 ? (
								<Button variant="primary" onClick={() => setAdding(true)}>
									<Plus />
									Add furniture item
								</Button>
							) : (
								<LinkButton href="/furniture-types">Go to Furniture types</LinkButton>
							)}
						</Card>
					)}

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
											{[item.category, item.description]
												.filter(Boolean)
												.join(" · ")}{" "}
											· {item.parts.length} parts, {item.labourHours}{" "}
											production hours
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
											{money(item.price)}
										</strong>
										<span className="text-right text-small text-fg-tertiary">
											Cost{" "}
											{wholeNaira(item.unitCostWithContingency * item.qty)}{" "}
											incl. {ratePercent(rates.contingency)} contingency ·
											markup {ratePercent(item.markup)} (cap{" "}
											{ratePercent(item.markupCap)})
										</span>
									</div>
									<Button
										variant="ghost"
										size="sm"
										icon
										aria-label={`Take ${item.name} off the quote`}
										title="Take off the quote"
										className="hover:bg-danger-subtle hover:text-danger-fg"
										onClick={() => removeItem(item.id)}
									>
										<Trash2 />
									</Button>
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
												<Button size="sm" {...notBuilt}>
													<Plus />
													Add part
												</Button>
												<LinkButton
													variant="ghost"
													size="sm"
													href={`/furniture-types/custom-design?for=${item.id}`}
												>
													Custom addition from photo
												</LinkButton>
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
													label={`Workshop overhead (${item.labourHours} h × ${wholeNaira(rates.overheadPerLabourHour)})`}
													value={wholeNaira(item.overhead)}
												/>
												{item.extras.map((e) => (
													<BreakdownRow
														key={e.name}
														label={e.name}
														value={wholeNaira(e.amount)}
													/>
												))}
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
							<Select
								label="Add a cost"
								className="min-w-55 flex-1 basis-55"
								value={costKind}
								onChange={(e) => {
									const option = projectCostOptions.find(
										(o) => o.id === e.target.value,
									);
									setCostKind(e.target.value);
									setCostAmount(option?.amount ? String(option.amount) : "");
								}}
							>
								{projectCostOptions.map((o) => (
									<option key={o.id} value={o.id}>
										{o.name}
										{o.amount ? ` (${wholeNaira(o.amount)})` : ", enter amount"}
									</option>
								))}
								<option value={CUSTOM_COST}>Another cost, enter amount</option>
							</Select>
							{(!costOption || costOption.amount === 0) && (
								<Input
									label={costOption ? "What and who" : "What it's for"}
									className="min-w-50 flex-1 basis-50"
									value={costNote}
									onChange={(e) => setCostNote(e.target.value)}
									placeholder="e.g. Glass top, Lekki Glass Works"
								/>
							)}
							<Input
								label="Amount (₦)"
								className="w-40"
								value={costAmount}
								onChange={(e) => setCostAmount(e.target.value)}
								inputMode="decimal"
							/>
							<Button onClick={addCost}>Add cost</Button>
						</div>
						<p className="px-5 pb-4 text-small text-fg-tertiary">
							Delivery, installation, site visits and third-party work. Standard
							amounts come from Cost rates; change them if this project is different.
						</p>
					</Card>

					<div className="flex flex-wrap gap-3">
						{pricing.items.length > 0 && (
							<Button onClick={() => setAdding(true)}>
								<Plus />
								Add furniture item
							</Button>
						)}
						<LinkButton href="/furniture-types/custom-design">
							<Plus />
							Custom design from photo
						</LinkButton>
					</div>
				</div>

				<aside aria-label="Quote totals" className="flex min-w-0 flex-col gap-6">
					<SummaryCard pricing={pricing} currency={currency} rates={rates} />
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
								<span className="inline-flex items-center gap-3">
									<span className="text-body font-bold">General discount</span>
									<Stepper
										value={Math.min(draft.discount, rates.maxDiscount)}
										min={0}
										onChange={(n) =>
											updateDraft({
												discount: Math.max(0, Math.min(rates.maxDiscount, n)),
											})
										}
										format={(n) => (n ? `${n}%` : "None")}
										decreaseLabel="Smaller discount"
										increaseLabel="Bigger discount"
									/>
								</span>
								{draft.discount > 0 && (
									<Input
										label="Reason"
										value={draft.discountReason}
										onChange={(e) =>
											updateDraft({ discountReason: e.target.value })
										}
										placeholder="Why this client gets a discount"
										hint="Shown to Accounting and the MD/GM, not on the client's quote."
									/>
								)}
								<p className="text-small text-fg-tertiary">
									General discount at your discretion, up to {rates.maxDiscount}%
									of the price before VAT. The MD or GM sets the limit.
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

			{adding && (
				<AddItemDrawer
					catalog={catalog}
					onQuote={draft.items}
					onAdd={addItem}
					onClose={() => setAdding(false)}
				/>
			)}
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
