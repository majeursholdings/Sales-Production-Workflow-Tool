"use client";

import { useState } from "react";
import Link from "next/link";
import {
	Check,
	CircleAlert,
	Clock,
	Download,
	ExternalLink,
	MoreHorizontal,
	Copy,
	Send,
	Ban,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/common/badge";
import { Button, LinkButton, buttonClasses } from "@/components/common/buttons";
import { Card } from "@/components/common/card";
import FollowUpMenu from "@/components/common/followUpMenu";
import { ConfirmDialog } from "@/components/common/modal";
import { SegmentedControl } from "@/components/common/segmented-control";
import PageTitle from "@/components/layout/pageTitle";
import PageWrapper from "@/components/layout/pageWrapper";
import { Input, Textarea } from "@/components/forms/input";
import { Menu, MenuItem } from "@/components/tables/menu";
import { Table } from "@/components/tables";
import { formatNaira } from "@/lib/currency";
import { QUOTE_STATUS, VAT_RATE, subtotal, type QuoteDetail } from "@/lib/quotes";

export default function QuoteDetailView({
	detail,
	canRecordDeposit,
}: {
	detail: QuoteDetail;
	canRecordDeposit: boolean;
}) {
	const { quote, contact, versions, depositRate } = detail;
	const current = versions[0];
	const [viewing, setViewing] = useState(current.n);
	// TODO: record the deposit and cancel through the backend once it exists; for now they only change this page.
	const [recorded, setRecorded] = useState(quote.status === "paid");
	const [cancelled, setCancelled] = useState(quote.status === "cancelled");
	const [cancelling, setCancelling] = useState(false);
	const [extraActivity, setExtraActivity] = useState<QuoteDetail["activity"]>([]);

	const version = versions.find((v) => v.n === viewing) ?? current;
	const isCurrent = version.n === current.n;
	const sub = subtotal(version.lines);
	const vat = sub * VAT_RATE;
	const total = sub + vat;

	const currentTotal = subtotal(current.lines) * (1 + VAT_RATE);
	const deposit = currentTotal * depositRate;
	const balance = currentTotal - deposit;

	const status = cancelled
		? QUOTE_STATUS.cancelled
		: !isCurrent
			? { label: "Superseded", tone: "neutral" as const }
			: recorded
				? QUOTE_STATUS.paid
				: QUOTE_STATUS[quote.status];

	const canTakeDeposit =
		isCurrent &&
		!recorded &&
		!cancelled &&
		(quote.status === "sent" || quote.status === "expiring");
	const activity = [...detail.activity, ...extraActivity];

	return (
		<PageWrapper>
			<PageTitle
				breadcrumbs={[{ label: "Quotes", href: "/quotes" }, { label: quote.id }]}
				pageTitle={quote.client}
				badge={{ label: status.label, variant: status.tone }}
				pageDescription={`${quote.id} · v${version.n} · Prepared by ${quote.createdBy} · ${detail.validityLine}`}
				actions={
					<>
						{contact.whatsapp && (
							<FollowUpMenu
								client={quote.client}
								email={contact.email}
								whatsapp={contact.whatsapp}
								phone={contact.phone}
								phoneLabel={contact.phoneLabel}
								subject={`Your Majeurs quote ${quote.id}`}
								message={`Hi ${quote.client.split(" ")[0]}, following up on your Majeurs quote ${quote.id}.`}
								size="md"
								onFollowed={() => {
									setExtraActivity((a) => [
										...a,
										{
											when: "Just now",
											what: "Follow-up logged",
											detail: "from this page",
										},
									]);
									toast.success(
										"Follow-up logged in the activity for this quote.",
									);
								}}
							/>
						)}
						<Button disabled title="Needs the quote builder, which isn't built yet">
							<ExternalLink />
							New version (v{current.n + 1})
						</Button>
						<Menu
							label="More actions for this quote"
							triggerClassName={buttonClasses({ variant: "secondary", icon: true })}
							trigger={<MoreHorizontal aria-hidden="true" />}
						>
							<MenuItem
								onSelect={() =>
									toast.success(
										`v${current.n} resent to ${contact.email || quote.client}.`,
									)
								}
								disabled={!contact.email}
							>
								<Send aria-hidden="true" />
								Resend v{current.n} to client
							</MenuItem>
							<MenuItem onSelect={() => {}} disabled>
								<Download aria-hidden="true" />
								Download PDF
							</MenuItem>
							<MenuItem onSelect={() => {}} disabled>
								<Copy aria-hidden="true" />
								Duplicate as new quote
							</MenuItem>
							<div role="separator" className="my-1 h-px bg-line" />
							<MenuItem
								tone="danger"
								onSelect={() => setCancelling(true)}
								disabled={cancelled}
							>
								<Ban aria-hidden="true" />
								Cancel quote
							</MenuItem>
						</Menu>
					</>
				}
			/>

			{versions.length > 1 && (
				<div className="flex flex-wrap items-center gap-3">
					<span className="text-overline text-fg-tertiary uppercase">Version</span>
					<SegmentedControl
						label="Quote version"
						value={String(viewing)}
						onChange={(v) => setViewing(Number(v))}
						options={versions.map((v) => ({
							value: String(v.n),
							label: `v${v.n} ${v.n === current.n ? "· Current" : "· Superseded"}`,
						}))}
					/>
				</div>
			)}

			{!isCurrent && (
				<div className="flex flex-wrap items-center gap-3 rounded-md border border-line bg-subtle px-4 py-3 text-body text-fg">
					<Clock aria-hidden="true" className="size-5 shrink-0 text-fg-secondary" />
					<span className="min-w-0 flex-1 basis-60">
						Superseded by v{current.n}. The client can&apos;t accept this version and no
						deposit can be recorded against it.
					</span>
					<Button size="sm" onClick={() => setViewing(current.n)}>
						View v{current.n}
					</Button>
				</div>
			)}

			<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
				<div className="flex min-w-0 flex-col gap-6">
					{isCurrent && version.changes && (
						<Card>
							<h2>What changed from v{version.n - 1}</h2>
							<ul className="flex flex-col">
								{version.changes.map((c) => (
									<li
										key={c.text}
										className="flex flex-wrap items-center gap-3 border-t border-line py-3 first:border-t-0 first:pt-0"
									>
										<Badge variant={c.tone}>{c.tag}</Badge>
										<span className="min-w-0 flex-1 basis-60 text-body text-fg">
											{c.text}
										</span>
										<span className="text-body font-bold whitespace-nowrap text-fg tabular">
											{c.amount}
										</span>
									</li>
								))}
							</ul>
							{version.changeNote && (
								<p className="text-small text-fg-tertiary">{version.changeNote}</p>
							)}
						</Card>
					)}

					<Card>
						<h2>Items</h2>
						<Table className="min-w-130 [&_th]:bg-transparent">
							<thead>
								<tr>
									<th scope="col">Item</th>
									<th scope="col" className="text-end">
										Qty
									</th>
									<th scope="col" className="text-end">
										Unit price
									</th>
									<th scope="col" className="text-end">
										Amount
									</th>
								</tr>
							</thead>
							<tbody>
								{version.lines.map((l) => (
									<tr key={`${l.name}-${l.desc}`}>
										<td className="align-top">
											<span className="flex flex-col">
												<span className="font-bold text-fg">{l.name}</span>
												<span className="text-small text-fg-tertiary">
													{l.desc}
												</span>
											</span>
										</td>
										<td className="text-end align-top tabular">{l.qty}</td>
										<td className="text-end align-top whitespace-nowrap tabular">
											{formatNaira(l.unit)}
										</td>
										<td className="text-end align-top font-bold whitespace-nowrap text-fg tabular">
											{formatNaira(l.qty * l.unit)}
										</td>
									</tr>
								))}
							</tbody>
						</Table>
						<div className="flex justify-end">
							<dl className="flex w-80 max-w-full flex-col gap-2">
								<div className="flex justify-between gap-3 text-body">
									<dt className="text-fg-secondary">Subtotal</dt>
									<dd className="tabular">{formatNaira(sub)}</dd>
								</div>
								<div className="flex justify-between gap-3 text-body">
									<dt className="text-fg-secondary">VAT ({VAT_RATE * 100}%)</dt>
									<dd className="tabular">{formatNaira(vat)}</dd>
								</div>
								<div className="flex items-baseline justify-between gap-3 border-t border-line pt-2 font-bold">
									<dt>Total</dt>
									<dd className="font-display text-total tabular">
										{formatNaira(total)}
									</dd>
								</div>
							</dl>
						</div>
					</Card>

					<Card>
						<h2>Activity</h2>
						<ul className="flex flex-col">
							{activity.map((a, i) => (
								<li
									key={`${a.when}-${i}`}
									className="flex flex-wrap gap-x-3 gap-y-1 border-t border-line py-3 first:border-t-0 first:pt-0 last:pb-0"
								>
									<span className="w-34 shrink-0 text-small text-fg-tertiary">
										{a.when}
									</span>
									<span className="min-w-0 flex-1 basis-60 text-body">
										<strong className="text-fg">{a.what}</strong>{" "}
										<span className="text-fg-secondary">{a.detail}</span>
									</span>
								</li>
							))}
						</ul>
					</Card>
				</div>

				<aside aria-label="Quote summary" className="flex min-w-0 flex-col gap-6">
					<Card>
						<h2>Versions</h2>
						<ul className="flex flex-col">
							{versions.map((v) => (
								<li
									key={v.n}
									className="flex items-start gap-3 border-t border-line py-3 first:border-t-0 first:pt-0 last:pb-0"
								>
									<span
										aria-hidden="true"
										className={`grid size-6 shrink-0 place-items-center rounded-full text-small font-bold ${v.n === current.n ? "bg-accent text-on-accent" : "bg-subtle text-fg-secondary"}`}
									>
										{v.n}
									</span>
									<span className="flex min-w-0 flex-1 flex-col">
										<strong className="text-fg">
											v{v.n} · {v.n === current.n ? "Current" : "Superseded"}
										</strong>
										<span className="text-small text-fg-tertiary">
											{v.sentLine} ·{" "}
											{formatNaira(subtotal(v.lines) * (1 + VAT_RATE))}
										</span>
									</span>
								</li>
							))}
						</ul>
						{versions.length > 1 && (
							<p className="text-small text-fg-tertiary">
								A new version keeps the quote number, resets the 7-day validity and
								replaces the version the client can accept. Only the current version
								can take a deposit.
							</p>
						)}
					</Card>

					{canTakeDeposit &&
						(canRecordDeposit ? (
							<Card className="gap-4">
								<div className="flex flex-col gap-1">
									<h2>Record deposit on v{current.n}</h2>
									<p className="text-small text-fg-tertiary">
										Confirm the transfer has landed before recording it.
										Recording creates the invoice and starts production.
									</p>
								</div>
								<div className="flex flex-col gap-1 rounded-md bg-accent-subtle p-3">
									<div className="flex justify-between gap-3 font-bold text-accent-fg">
										<span>Deposit due ({Math.round(depositRate * 100)}%)</span>
										<span className="tabular">{formatNaira(deposit)}</span>
									</div>
									<span className="text-small text-fg-secondary">
										Balance of {formatNaira(balance)} before delivery. The
										deposit rate is set in{" "}
										<Link href="/settings/tax">Settings</Link>; this quote keeps
										the rate it was sent with.
									</span>
								</div>
								<Input
									label="Amount received"
									defaultValue={formatNaira(deposit)}
									inputMode="decimal"
								/>
								<Input label="Date received" defaultValue="7 Nov 2026" />
								<Input
									label="Transfer reference"
									placeholder="From the bank alert"
									hint="Payment is by bank transfer only for now."
								/>
								<Button
									variant="primary"
									className="w-full"
									onClick={() => {
										setRecorded(true);
										setExtraActivity((a) => [
											...a,
											{
												when: "Just now",
												what: `Deposit recorded on v${current.n}`,
												detail: `${formatNaira(deposit)}; invoice created`,
											},
										]);
										toast.success("Deposit recorded.");
									}}
								>
									Record deposit
								</Button>
							</Card>
						) : (
							<Card>
								<h2>Deposit</h2>
								<p className="text-body text-fg-secondary">
									Accounting records the {Math.round(depositRate * 100)}% deposit
									({formatNaira(deposit)}) once the transfer lands.
								</p>
							</Card>
						))}

					{isCurrent && recorded && !cancelled && (
						<>
							<section
								role="status"
								className="flex flex-col gap-1 rounded-lg border border-success-line bg-success-subtle p-5"
							>
								<h2 className="text-success-fg">
									Deposit of {formatNaira(deposit)} recorded
								</h2>
								<p className="text-body text-fg">
									Invoice created. Balance of {formatNaira(balance)} is due before
									delivery.
								</p>
							</section>
							<Card>
								<h2>Started automatically</h2>
								<ul className="flex flex-col gap-3 text-body">
									<li className="flex gap-3">
										<Check
											aria-hidden="true"
											className="mt-0.5 size-5 shrink-0 text-success-fg"
										/>
										<span>
											<strong className="text-fg">Job card created</strong>
											<br />
											<span className="text-fg-secondary">
												Sent to production with specs and quantities
											</span>
										</span>
									</li>
									<li className="flex gap-3">
										<Check
											aria-hidden="true"
											className="mt-0.5 size-5 shrink-0 text-success-fg"
										/>
										<strong className="text-fg">
											Stock reserved for the parts in stock
										</strong>
									</li>
									<li className="flex gap-3">
										<CircleAlert
											aria-hidden="true"
											className="mt-0.5 size-5 shrink-0 text-warning-fg"
										/>
										<span>
											<strong className="text-fg">
												Parts not in stock go on the shortfall list
											</strong>
											<br />
											<span className="text-fg-secondary">
												Procurement notified.
											</span>
										</span>
									</li>
								</ul>
								<div className="flex flex-wrap gap-2">
									<LinkButton href="/invoices" size="sm">
										View invoices
									</LinkButton>
									<LinkButton href="/work-orders" size="sm">
										Job cards
									</LinkButton>
									<LinkButton href="/inventory" variant="ghost" size="sm">
										Shortfall list
									</LinkButton>
								</div>
							</Card>
						</>
					)}
				</aside>
			</div>

			{cancelling && (
				<ConfirmDialog
					title={`Cancel ${quote.id}?`}
					confirmLabel="Cancel quote"
					cancelLabel="Keep quote"
					onCancel={() => setCancelling(false)}
					onConfirm={() => {
						setCancelling(false);
						setCancelled(true);
						setExtraActivity((a) => [
							...a,
							{ when: "Just now", what: "Quote cancelled", detail: "from this page" },
						]);
						toast.success("Quote cancelled.");
					}}
				>
					<div className="flex flex-col gap-4">
						<p>
							{quote.client.split(" ")[0]} can no longer accept any version of this
							quote, and any cost requests still open for it are withdrawn. The quote
							stays in the records as Cancelled.
						</p>
						<Textarea
							label="Reason"
							placeholder="e.g. Client chose another supplier, budget changed…"
						/>
					</div>
				</ConfirmDialog>
			)}
		</PageWrapper>
	);
}
