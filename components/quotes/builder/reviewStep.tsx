"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Send } from "lucide-react";
import { Button, LinkButton } from "@/components/common/buttons";
import { Card } from "@/components/common/card";
import { SegmentedControl } from "@/components/common/segmented-control";
import PageWrapper from "@/components/layout/pageWrapper";
import { Input, Textarea } from "@/components/forms/input";
import {
	clientLines,
	formatMoney,
	priceQuote,
	ratePercent,
	type Currency,
	type QuoteBuilderSetup,
} from "@/lib/quoteBuilder";
import { resetDraft, updateDraft, useQuoteDraft } from "@/lib/quoteDraft";
import BuilderHeader from "./builderHeader";
import { cannotSave, useSaveQuote } from "./useSaveQuote";

/** The paper stays light in dark mode: it previews what the client receives. */
const paper = "text-[#211d1a]";
const paperMuted = "text-[#514c47]";

export default function ReviewStep({
	createdBy,
	setup,
}: {
	createdBy: string;
	setup: QuoteBuilderSetup;
}) {
	const router = useRouter();
	const draft = useQuoteDraft();
	const { catalog, rates } = setup;
	const pricing = priceQuote(draft, catalog, rates);
	const { client, currency } = draft;
	const m = (n: number) => formatMoney(n, currency, rates.usdRate);
	const header = draft.savedHeader ?? setup.header;
	const { save, saving } = useSaveQuote();
	const blocked = cannotSave(draft);
	const sent = draft.sent;

	if (!client) {
		return (
			<PageWrapper>
				<BuilderHeader step={3} createdBy={createdBy} header={header} />
				<Card>
					<h2>Choose a client first</h2>
					<p className="text-body text-fg-secondary">
						The quote needs to know who it&apos;s for before it can be reviewed and
						sent.
					</p>
					<div>
						<LinkButton href="/quotes/new" variant="primary">
							Choose client
						</LinkButton>
					</div>
				</Card>
			</PageWrapper>
		);
	}

	const first = client.name.split(" ")[0];
	const percent = ratePercent(rates.depositRate);
	const lines = clientLines(pricing, draft.projectCosts);
	const usd = rates.usdRate.toLocaleString("en-NG");

	return (
		<PageWrapper>
			<BuilderHeader
				step={3}
				createdBy={createdBy}
				header={header}
				saved={draft.quoteNumber !== null}
				sent={sent}
				actions={
					<>
						<LinkButton href="/quotes/new/items">Back to items</LinkButton>
						{!sent && (
							<Button
								disabled={blocked !== null || saving}
								title={blocked ?? undefined}
								onClick={() => save(draft, false)}
							>
								{saving ? "Saving…" : "Save draft"}
							</Button>
						)}
						<Button disabled title="PDF download isn't built yet">
							<Download />
							Download PDF
						</Button>
					</>
				}
			/>

			<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
				<div className="flex min-w-0 flex-col gap-2">
					<span className="text-overline text-fg-tertiary uppercase">Client preview</span>
					<article
						className={`flex flex-col gap-6 rounded-lg border border-[#e8e6e3] bg-[#fefdfd] p-8 max-md:p-5 ${paper}`}
					>
						<header className="flex flex-wrap justify-between gap-4">
							<Image
								src="/majeurs-logo-black.png"
								alt="Majeurs"
								width={180}
								height={41}
								className="h-auto w-44"
							/>
							<div className="flex flex-col items-end gap-1 text-end">
								<span className="text-overline font-bold text-[#6e4022] uppercase">
									Quote
								</span>
								<strong>{header.number}</strong>
								<span className={`text-small ${paperMuted}`}>
									Issued {header.issued}
									<br />
									Valid until {header.validUntil}
								</span>
							</div>
						</header>

						<div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-6">
							<div className="flex flex-col gap-1">
								<span className="text-overline font-bold text-[#69645d] uppercase">
									Bill to
								</span>
								<strong>{client.company || client.name}</strong>
								{client.company && (
									<span className={`text-small ${paperMuted}`}>
										{client.name}
									</span>
								)}
								<span className={`text-small whitespace-pre-line ${paperMuted}`}>
									{[client.location, client.contact].filter(Boolean).join("\n")}
								</span>
							</div>
							<div className="flex flex-col gap-1">
								<span className="text-overline font-bold text-[#69645d] uppercase">
									Prepared by
								</span>
								<strong>{createdBy}</strong>
								<span className={`text-small ${paperMuted}`}>Majeurs</span>
							</div>
						</div>

						<div className="overflow-x-auto">
							<table className="w-full min-w-130 border-collapse text-body">
								<thead>
									<tr className="border-b border-[#e8e6e3] text-start text-overline tracking-[0.06em] text-[#69645d] uppercase">
										<th className="py-2 pe-3 text-start">Item</th>
										<th className="px-3 py-2 text-end">Qty</th>
										<th className="px-3 py-2 text-end">Unit price</th>
										<th className="py-2 ps-3 text-end">Amount</th>
									</tr>
								</thead>
								<tbody>
									{lines.map((l) => (
										<tr
											key={l.name}
											className="border-b border-[#e8e6e3] align-top"
										>
											<td className="py-3 pe-3">
												<strong>{l.name}</strong>
												{l.description && (
													<>
														<br />
														<span className={`text-small ${paperMuted}`}>
															{l.description}
														</span>
													</>
												)}
											</td>
											<td className="px-3 py-3 text-end tabular">{l.qty}</td>
											<td className="px-3 py-3 text-end whitespace-nowrap tabular">
												{m(l.unitPrice)}
											</td>
											<td className="py-3 ps-3 text-end font-bold whitespace-nowrap tabular">
												{m(l.unitPrice * l.qty)}
											</td>
										</tr>
									))}
									{lines.length === 0 && (
										<tr>
											<td colSpan={4} className={`py-3 ${paperMuted}`}>
												No items yet.
											</td>
										</tr>
									)}
								</tbody>
							</table>
						</div>

						<div className="flex justify-end">
							<dl className="flex w-80 max-w-full flex-col gap-2 text-body">
								<div className="flex justify-between gap-3">
									<dt className={paperMuted}>
										Subtotal
										{pricing.discountPercent > 0 &&
											` (includes ${pricing.discountPercent}% discount)`}
									</dt>
									<dd className="tabular">{m(pricing.subtotal)}</dd>
								</div>
								<div className="flex justify-between gap-3">
									<dt className={paperMuted}>VAT ({ratePercent(rates.vatRate)})</dt>
									<dd className="tabular">{m(pricing.vat)}</dd>
								</div>
								<div className="flex items-baseline justify-between gap-3 border-t border-[#e8e6e3] pt-2 font-bold">
									<dt>Total</dt>
									<dd className="font-display text-total tabular">
										{m(pricing.total)}
									</dd>
								</div>
								<div className="flex justify-between gap-3 font-bold">
									<dt>Deposit due ({percent})</dt>
									<dd className="tabular">{m(pricing.deposit)}</dd>
								</div>
								<div className="flex justify-between gap-3">
									<dt className={paperMuted}>Balance before delivery</dt>
									<dd className="tabular">{m(pricing.balance)}</dd>
								</div>
							</dl>
						</div>

						<footer className="flex flex-col gap-1 border-t border-[#e8e6e3] pt-5">
							<span className="text-overline font-bold text-[#69645d] uppercase">
								Payment &amp; terms
							</span>
							<span className={`text-small ${paperMuted}`}>
								Pay the {percent} deposit by bank transfer to confirm your order;
								production starts once it is received. The balance is due before
								delivery. This quote is valid until {header.validUntil}. [BANK
								DETAILS FROM SETTINGS]
							</span>
						</footer>
					</article>
				</div>

				<aside aria-label="Send quote" className="flex min-w-0 flex-col gap-6">
					{!sent ? (
						<Card className="gap-4">
							<h2>Send quote</h2>
							<Input
								label="Client email"
								type="email"
								defaultValue={client.email}
								placeholder="name@example.com"
							/>
							<Input
								label="CC (optional)"
								type="email"
								placeholder="Add an email"
								hint="Separate addresses with commas."
							/>
							<div className="flex flex-col gap-2">
								<span className="text-body font-bold">Quote currency</span>
								<SegmentedControl<Currency>
									label="Quote currency"
									value={currency}
									onChange={(c) => updateDraft({ currency: c })}
									options={[
										{ value: "NGN", label: "₦ NGN" },
										{ value: "USD", label: "$ USD" },
									]}
									className="self-start"
								/>
								<small className="text-small text-fg-tertiary">
									{currency === "USD"
										? `Converted at today’s rate (₦${usd} = $1); the rate is locked on send.`
										: `USD converts at the rate on send (≈ ${formatMoney(pricing.total, "USD", rates.usdRate)} today).`}
								</small>
							</div>
							<Textarea
								label="Message"
								defaultValue={`Hi ${first}, thank you for choosing Majeurs. Your quote is attached; a ${percent} deposit by transfer confirms the order and starts production.`}
								className="[&_textarea]:h-26"
							/>
							<label className="flex items-center gap-2 text-body">
								<input
									type="checkbox"
									defaultChecked
									className="size-4 accent-accent"
								/>
								Also send on WhatsApp
								{client.contact ? ` (${client.contact.split(" · ")[0]})` : ""}
							</label>
							<Button
								variant="primary"
								className="w-full"
								disabled={blocked !== null || saving}
								title={blocked ?? undefined}
								// TODO: email the PDF and WhatsApp the client once sending is connected
								onClick={() => save(draft, true)}
							>
								<Send />
								{saving ? "Saving…" : "Send quote"}
							</Button>
							<p className="text-small text-fg-tertiary">
								Saves the quote and marks it as Sent. Emailing the PDF isn&apos;t
								connected yet, so share it with the client yourself for now.
							</p>
						</Card>
					) : (
						<section
							role="status"
							className="flex flex-col items-start gap-2 rounded-lg border border-success-line bg-success-subtle p-5"
						>
							<h2 className="text-success-fg">
								Quote {header.number} marked as sent
							</h2>
							<p className="text-body text-fg">
								In {currency === "USD" ? "US dollars" : "naira"}. It expires on{" "}
								{header.validUntil} if no deposit is recorded.
							</p>
							<Button
								size="sm"
								onClick={() => {
									resetDraft();
									router.push("/quotes");
								}}
							>
								Back to quotes
							</Button>
						</section>
					)}
					<Card className="text-body text-fg-secondary">
						<h2 className="text-fg">What happens next</h2>
						<ol className="flex list-decimal flex-col gap-1 ps-5">
							<li>
								The client pays the {percent} deposit by transfer. The deposit rate
								is set in{" "}
								<Link href="/settings/tax">Settings › Tax, FX &amp; deposit</Link>.
							</li>
							<li>Accounting records the deposit on this quote.</li>
							<li>
								The job card, stock reservation and procurement shortfall list are
								created automatically.
							</li>
						</ol>
					</Card>
				</aside>
			</div>
		</PageWrapper>
	);
}
