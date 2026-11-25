"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
	Check,
	Eye,
	FileText,
	MoreVertical,
	PackageCheck,
	PackageSearch,
	Pencil,
	Printer,
	RotateCcw,
	Timer,
	Truck,
} from "lucide-react";
import { toast } from "sonner";
import {
	logTimeAction,
	pickPartAction,
	recordDeliveryAction,
	recordRedoAction,
	reservePartsAction,
	updateJobCardAction,
	type JobCardDetails,
} from "@/app/(dashboard)/work-orders/actions";
import { Button, buttonClasses } from "@/components/common/buttons";
import { Badge } from "@/components/common/badge";
import { Card, CardHeader } from "@/components/common/card";
import OverviewCards from "@/components/common/overViewCard";
import PageTitle from "@/components/layout/pageTitle";
import { Menu, MenuItem } from "@/components/tables/menu";
import { IconButton, IconLink, StatusBadge, Table, TableState } from "@/components/tables";
import { cn } from "@/lib/cn";
import {
	DELIVERY_STATE,
	PART_TONE,
	STEP_NAMES,
	STEP_STATUS,
	buildJobCardOverview,
	cardFigures,
	fmtHours,
	longDate,
	shortDate,
	stepFigures,
	stepLabel,
	type DeliveryDraft,
	type JobCard,
	type LogDraft,
	type WorkshopPerson,
} from "@/lib/jobCards";
import type { MachineOption } from "@/lib/machines";
import DeliveryDrawer from "./deliveryDrawer";
import EditJobCardDrawer from "./editJobCardDrawer";
import FurnitureIcon from "./furnitureIcon";
import HoursBar from "./hoursBar";
import LogTimeDrawer from "./logTimeDrawer";
import RedoDrawer, { type RedoDraft } from "./redoDrawer";
import StepDrawer, { type SendBackDraft } from "./stepDrawer";

type Drawer =
	| { kind: "step"; step: number }
	| { kind: "log"; step: number; finished?: boolean }
	| { kind: "redo"; step: number }
	| { kind: "delivery" }
	| { kind: "edit" }
	| null;

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className="flex items-baseline justify-between gap-4 border-t border-line py-2.5 first:border-t-0">
			<dt className="text-small text-fg-secondary">{label}</dt>
			<dd className="text-end text-body text-fg">{children}</dd>
		</div>
	);
}

/**
 * A job card's page: title and actions, overview figures, the steps, what to
 * build, the parts list, and the redos and delivery. They all change together
 * when time is logged, so they live together here.
 */
export default function JobCardDetailView({
	card,
	today,
	machines,
	people,
	viewer,
}: {
	card: JobCard;
	today: string;
	/** Machines that are in service, for logging machine time. */
	machines: MachineOption[];
	/** The Production team, who can log time. */
	people: WorkshopPerson[];
	viewer: { name: string; canEdit: boolean; canOpenQuote: boolean };
}) {
	const router = useRouter();
	const [drawer, setDrawer] = useState<Drawer>(null);

	const figures = cardFigures(card);
	const label = stepLabel(card, figures.current);
	const open = !card.closed;
	const editable = viewer.canEdit && open;
	const current = figures.current;
	const currentStep = current === null ? null : card.steps[current];
	const canFinishCurrent = current !== null && currentStep?.status !== "blocked";

	// The step the page is at, or the last step that has been started, for the redo form
	const startedSteps = card.steps
		.map((s, i) => ({ s, i }))
		.filter(({ s, i }) => i < 5 && s.status !== "todo" && s.status !== "blocked");
	const lastStarted = startedSteps.length ? startedSteps[startedSteps.length - 1].i : 0;

	const alert = card.blockedNote
		? { tone: "border-warning-line bg-warning-subtle", text: card.blockedNote }
		: card.delivery.state === "rejected" && card.rejectedNote
			? { tone: "border-danger-line bg-danger-subtle", text: card.rejectedNote }
			: null;

	const close = () => setDrawer(null);

	/** Runs a server action; on success closes the drawer and confirms, otherwise shows why. */
	const run = async (action: Promise<{ ok: boolean; message?: string }>, message: string) => {
		const result = await action;
		if (!result.ok) {
			toast.error(result.message ?? "Something went wrong. Try again.");
			return;
		}
		close();
		toast.success(message);
	};

	const saveLog = (draft: LogDraft) =>
		run(
			logTimeAction(card.id, {
				...draft,
				machines: draft.machines.map((m) => ({ machineId: m.machineId, hours: m.hours })),
			}),
			`${fmtHours(draft.hours)} logged on ${STEP_NAMES[draft.step].toLowerCase()}${
				draft.machines.length
					? `, with ${draft.machines.length} ${draft.machines.length === 1 ? "machine" : "machines"}`
					: ""
			}.`,
		);

	const saveRedo = (draft: RedoDraft) =>
		run(
			recordRedoAction(card.id, draft),
			`${STEP_NAMES[draft.step]} marked for redo. ${fmtHours(draft.hours)} extra expected; it shows in Redos and rejections.`,
		);

	const saveSendBack = (draft: SendBackDraft) =>
		run(
			recordRedoAction(card.id, {
				step: draft.step,
				reason: draft.reason,
				hours: draft.hours,
				foundAt: STEP_NAMES[current ?? draft.step],
				date: today,
			}),
			`${STEP_NAMES[draft.step]} sent back for redo. It and the steps after it are reopened.`,
		);

	const saveDelivery = (draft: DeliveryDraft) =>
		run(
			recordDeliveryAction(
				card.id,
				draft.outcome === "accepted"
					? { outcome: "accepted", date: draft.date, by: draft.by, notes: draft.notes }
					: {
							outcome: "rejected",
							date: draft.date,
							by: draft.by,
							notes: draft.notes,
							what: draft.what ?? "",
							reason: draft.reason ?? "Other",
							backTo: draft.backTo ?? 0,
						},
			),
			draft.outcome === "accepted"
				? "Delivery recorded. The job card is closed."
				: `Rejection recorded. ${STEP_NAMES[draft.backTo ?? 0]} and the steps after it are reopened.`,
		);

	const saveDetails = (details: JobCardDetails) =>
		run(updateJobCardAction(card.id, details), "Job card details saved.");

	const reserve = async () => {
		const result = await reservePartsAction(card.id);
		if (!result.ok) {
			toast.error(result.message);
			return;
		}
		toast.success(
			result.data.short
				? "Reserved what's in stock. Some parts are still short."
				: "All parts are reserved. Cutting can start.",
		);
	};

	const pick = (sku: string, name: string) =>
		run(pickPartAction(card.id, sku), `${name} picked and taken out of stock.`);

	return (
		<>
			<p className="hidden text-small text-fg-tertiary print:block">
				Majeurs · Job sheet · printed {longDate(today)}
			</p>
			<PageTitle
				breadcrumbs={[{ label: "Job cards", href: "/work-orders" }, { label: card.id }]}
				pageTitle={card.client}
				pageDescription={`${card.id} · from quote ${card.quote} · due ${longDate(card.due)}`}
				badge={{ label: label.label, variant: label.tone }}
				actions={
					<>
						{viewer.canEdit && (
							<Button
								variant="primary"
								disabled={!open}
								onClick={() => setDrawer({ kind: "log", step: current ?? 0 })}
							>
								<Timer />
								Log time
							</Button>
						)}
						<Menu
							label="More actions for this job card"
							triggerClassName={buttonClasses({ icon: true })}
							trigger={<MoreVertical aria-hidden="true" />}
						>
							{viewer.canEdit && (
								<>
									<MenuItem
										disabled={!editable}
										onSelect={() =>
											setDrawer({ kind: "redo", step: lastStarted })
										}
									>
										<RotateCcw aria-hidden="true" />
										Record a redo
									</MenuItem>
									<MenuItem
										disabled={!editable || !canFinishCurrent}
										onSelect={() =>
											setDrawer({
												kind: "log",
												step: current ?? 0,
												finished: true,
											})
										}
									>
										<Check aria-hidden="true" />
										{current === null
											? "All steps finished"
											: `Mark ${STEP_NAMES[current].toLowerCase()} finished`}
									</MenuItem>
									<MenuItem
										disabled={!open}
										onSelect={() => setDrawer({ kind: "delivery" })}
									>
										<Truck aria-hidden="true" />
										Record delivery
									</MenuItem>
									<MenuItem
										disabled={!open}
										onSelect={() => setDrawer({ kind: "edit" })}
									>
										<Pencil aria-hidden="true" />
										Edit details and booking
									</MenuItem>
									<MenuItem
										disabled={
											!open ||
											!card.parts.some(
												(p) =>
													p.status === "Short" || p.status === "On order",
											)
										}
										onSelect={reserve}
									>
										<PackageSearch aria-hidden="true" />
										Reserve parts from stock
									</MenuItem>
								</>
							)}
							<MenuItem onSelect={() => window.print()}>
								<Printer aria-hidden="true" />
								Print job sheet
							</MenuItem>
							{viewer.canOpenQuote && (
								<MenuItem onSelect={() => router.push(`/quotes/${card.quote}`)}>
									<FileText aria-hidden="true" />
									Open quote {card.quote}
								</MenuItem>
							)}
						</Menu>
					</>
				}
			/>

			{alert && (
				<div
					role="status"
					className={cn(
						"flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 text-body text-fg",
						alert.tone,
					)}
				>
					<span className="min-w-0 flex-1">{alert.text}</span>
				</div>
			)}

			<OverviewCards
				aria-label="This job card at a glance"
				items={buildJobCardOverview(card, today)}
			/>

			<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)] lg:items-start">
				<div className="flex min-w-0 flex-col gap-6">
					<Card flush aria-labelledby="steps-title">
						<CardHeader>
							<h2 id="steps-title" className="flex-1">
								Steps
							</h2>
							<span className="text-small text-fg-tertiary">
								Actual against planned hours
							</span>
							{editable && (
								<Button
									size="sm"
									className="print:hidden"
									onClick={() => setDrawer({ kind: "redo", step: lastStarted })}
								>
									<RotateCcw />
									Record a redo
								</Button>
							)}
						</CardHeader>
						<Table>
							<thead>
								<tr>
									<th scope="col">Step</th>
									<th scope="col">Status</th>
									<th scope="col" className="text-end">
										Hours
									</th>
									<th scope="col" className="text-end">
										Machine time
									</th>
									<th scope="col" className="print:hidden">
										<span className="sr-only">Actions</span>
									</th>
								</tr>
							</thead>
							<tbody>
								{card.steps.map((s, i) => {
									const f = stepFigures(s);
									const who = [...new Set(s.entries.map((e) => e.who))];
									const hasMachines = f.machinePlanned > 0 || f.machineActual > 0;
									return (
										<tr key={STEP_NAMES[i]}>
											<td>
												<span className="flex flex-col">
													<span className="font-bold text-fg">
														{i + 1}. {STEP_NAMES[i]}
													</span>
													<span className="text-small text-fg-tertiary">
														{who.length
															? who.slice(0, 2).join(", ") +
																(who.length > 2
																	? ` +${who.length - 2}`
																	: "")
															: "Nobody yet"}
													</span>
												</span>
											</td>
											<td>
												<span className="flex flex-col items-start gap-1">
													<StatusBadge tone={STEP_STATUS[s.status].tone}>
														{STEP_STATUS[s.status].label}
													</StatusBadge>
													{s.redos.length > 0 && (
														<span className="text-small text-warning-fg">
															{s.redos.length}{" "}
															{s.redos.length === 1
																? "redo"
																: "redos"}
															{f.redoHours
																? `, ${fmtHours(f.redoHours)}`
																: ""}
														</span>
													)}
												</span>
											</td>
											<td className="text-end">
												<span className="flex flex-col items-end">
													<span className="flex items-center gap-2">
														<HoursBar
															actual={f.actual}
															planned={s.plannedHours}
														/>
														<span className="font-bold whitespace-nowrap text-fg tabular">
															{fmtHours(f.actual)}
														</span>
													</span>
													<span className="text-small whitespace-nowrap text-fg-tertiary">
														of {fmtHours(s.plannedHours)} planned
													</span>
												</span>
											</td>
											<td className="text-end">
												<span className="flex flex-col items-end">
													<span className="tabular">
														{hasMachines
															? fmtHours(f.machineActual)
															: "—"}
													</span>
													<span className="text-small text-fg-tertiary">
														{hasMachines
															? `of ${fmtHours(f.machinePlanned)}`
															: "No machines"}
													</span>
												</span>
											</td>
											<td className="text-end print:hidden">
												<IconButton
													aria-label={`View step ${i + 1}, ${STEP_NAMES[i]}`}
													title="View step"
													onClick={() =>
														setDrawer({ kind: "step", step: i })
													}
												>
													<Eye aria-hidden="true" />
												</IconButton>
											</td>
										</tr>
									);
								})}
							</tbody>
						</Table>
					</Card>

					<Card flush aria-labelledby="build-title">
						<CardHeader>
							<h2 id="build-title" className="flex-1">
								What to build
							</h2>
							<span className="text-small text-fg-tertiary">
								Specs from the furniture types on the quote
							</span>
						</CardHeader>
						<Table>
							<thead>
								<tr>
									<th scope="col">Item</th>
									<th scope="col" className="text-end">
										Qty
									</th>
									<th scope="col" className="print:hidden">
										<span className="sr-only">Actions</span>
									</th>
								</tr>
							</thead>
							<tbody>
								{card.build.length === 0 && (
									<tr>
										<td colSpan={3}>
											<TableState
												kind="empty"
												title="Nothing to build"
												description="The quote this job card came from had no items."
											/>
										</td>
									</tr>
								)}
								{card.build.map((item) => (
									<tr key={item.name}>
										<td>
											<span className="flex items-center gap-3">
												<FurnitureIcon kind={item.kind} />
												<span className="flex min-w-0 flex-col">
													<span className="font-bold text-fg">
														{item.name}
													</span>
													<span className="text-small text-fg-tertiary">
														{item.spec}
													</span>
												</span>
											</span>
										</td>
										<td className="text-end font-bold text-fg tabular">
											{item.qty}
										</td>
										<td className="text-end print:hidden">
											<IconLink
												href="/furniture-types"
												aria-label={`View the ${item.name.toLowerCase()} furniture type`}
												title="View furniture type"
											>
												<Eye aria-hidden="true" />
											</IconLink>
										</td>
									</tr>
								))}
							</tbody>
						</Table>
					</Card>

					<Card flush aria-labelledby="parts-title">
						<CardHeader>
							<h2 id="parts-title" className="flex-1">
								Parts picking list
							</h2>
							<span className="text-small text-fg-tertiary">
								Reserved from stock when the job card was started
							</span>
						</CardHeader>
						<Table>
							<thead>
								<tr>
									<th scope="col">Part</th>
									<th scope="col" className="text-end">
										Needed
									</th>
									<th scope="col">Status</th>
									{editable && (
										<th scope="col" className="print:hidden">
											<span className="sr-only">Actions</span>
										</th>
									)}
								</tr>
							</thead>
							<tbody>
								{card.parts.length === 0 && (
									<tr>
										<td colSpan={editable ? 4 : 3}>
											<TableState
												kind="empty"
												title="No parts listed"
												description="This job card was started without a picking list."
											/>
										</td>
									</tr>
								)}
								{card.parts.map((p) => (
									<tr key={p.sku}>
										<td>
											<span className="flex flex-col">
												<span className="font-bold text-fg">{p.name}</span>
												<span className="text-small text-fg-tertiary">
													{p.spec}
												</span>
											</span>
										</td>
										<td className="text-end tabular">{p.qty}</td>
										<td>
											<StatusBadge tone={PART_TONE[p.status]}>
												{p.status}
											</StatusBadge>
										</td>
										{editable && (
											<td className="text-end print:hidden">
												{p.status === "Reserved" && (
													<IconButton
														aria-label={`Mark ${p.name.toLowerCase()} picked`}
														title="Mark picked"
														onClick={() => pick(p.sku, p.name)}
													>
														<PackageCheck aria-hidden="true" />
													</IconButton>
												)}
											</td>
										)}
									</tr>
								))}
							</tbody>
						</Table>
						{card.parts.some(
							(p) => p.status === "Short" || p.status === "On order",
						) && (
							<p className="border-t border-line px-5 py-3 text-small text-fg-tertiary">
								Short parts are ordered on{" "}
								<Link href="/purchase-orders">purchase orders</Link> by procurement.
								Once they arrive, use “Reserve parts from stock” in the ⋯ menu.
							</p>
						)}
					</Card>
				</div>

				<aside aria-label="Redos and delivery" className="flex min-w-0 flex-col gap-6">
					<Card aria-labelledby="redos-title" className="gap-1">
						<h2 id="redos-title" className="mb-2">
							Redos and rejections
						</h2>
						{figures.redos.length === 0 ? (
							<p className="text-small text-fg-tertiary">
								None so far.
								{viewer.canEdit &&
									" Use “Send back for redo” on a step, or record a rejected delivery from the ⋯ menu."}
							</p>
						) : (
							<ul>
								{figures.redos.map((r) => {
									const rejection = r.foundAt === "Delivery";
									return (
										<li
											key={r.id}
											className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-start gap-x-3 border-t border-line py-3 first:border-t-0"
										>
											<span
												aria-hidden="true"
												className={cn(
													"grid size-8 place-items-center rounded-full [&_svg]:size-4",
													rejection
														? "bg-danger-subtle text-danger-fg"
														: "bg-warning-subtle text-warning-fg",
												)}
											>
												{rejection ? <Truck /> : <RotateCcw />}
											</span>
											<span className="flex min-w-0 flex-col gap-0.5">
												<strong className="text-body">
													{rejection
														? "Delivery rejected"
														: `${STEP_NAMES[r.step]} redone`}
													{rejection &&
														r.step < 5 &&
														`: back to ${STEP_NAMES[r.step].toLowerCase()}`}
												</strong>
												<span className="text-small text-fg-secondary">
													{r.reason}
												</span>
												<span className="text-small text-fg-tertiary">
													{shortDate(r.date)} · found at{" "}
													{r.foundAt.toLowerCase()}
												</span>
											</span>
											<span className="text-small font-bold whitespace-nowrap text-fg tabular">
												+{fmtHours(r.hours)} est.
											</span>
										</li>
									);
								})}
							</ul>
						)}
					</Card>

					<Card aria-labelledby="delivery-title">
						<h2 id="delivery-title">Delivery</h2>
						<dl className="flex flex-col">
							<DetailRow label="Address">{card.address}</DetailRow>
							<DetailRow label="Status">
								<Badge variant={DELIVERY_STATE[card.delivery.state].tone}>
									{card.delivery.note}
								</Badge>
							</DetailRow>
						</dl>
						<p className="border-t border-line pt-3 text-small text-fg-secondary">
							<strong className="text-fg">Note from customer care:</strong>{" "}
							{card.note || "None."}
						</p>
					</Card>
				</aside>
			</div>

			{drawer?.kind === "step" && (
				<StepDrawer
					key={drawer.step}
					card={card}
					step={drawer.step}
					canEdit={viewer.canEdit}
					onLog={() => setDrawer({ kind: "log", step: drawer.step })}
					onSendBack={saveSendBack}
					onClose={close}
				/>
			)}
			{drawer?.kind === "log" && (
				<LogTimeDrawer
					key={`${drawer.step}-${drawer.finished ? "done" : "log"}`}
					card={card}
					step={drawer.step}
					finished={drawer.finished}
					machines={machines}
					people={people}
					userName={viewer.name}
					today={today}
					onSave={saveLog}
					onClose={close}
				/>
			)}
			{drawer?.kind === "redo" && (
				<RedoDrawer
					key={drawer.step}
					card={card}
					step={drawer.step}
					current={current}
					userName={viewer.name}
					today={today}
					onSave={saveRedo}
					onClose={close}
				/>
			)}
			{drawer?.kind === "edit" && (
				<EditJobCardDrawer card={card} today={today} onSave={saveDetails} onClose={close} />
			)}
			{drawer?.kind === "delivery" && (
				<DeliveryDrawer
					card={card}
					userName={viewer.name}
					today={today}
					onSave={saveDelivery}
					onClose={close}
				/>
			)}
		</>
	);
}
