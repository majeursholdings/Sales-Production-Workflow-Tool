import Image from "next/image";
import { Table } from "@/components/tables";
import type { BankDetails } from "@/lib/companySettings";
import { formatNaira } from "@/lib/currency";
import { issuedLabel, type InvoiceDetail } from "@/lib/invoices";

/** The invoice as the client sees it: letterhead, who it's for, the items, the totals and what's still due. */
export default function InvoiceDocument({
	detail,
	balance,
	bank,
	footer,
}: {
	detail: InvoiceDetail;
	balance: number;
	/** From Settings → Bank & terms. */
	bank: BankDetails;
	footer: string;
}) {
	const { invoice, billTo, lines, subtotal: sub, vatRate } = detail;
	const { payments } = invoice;
	// VAT is whatever takes the frozen subtotal to the frozen total, so the figures always add up
	const vat = invoice.total - sub;

	return (
		<article
			aria-label={`Invoice ${invoice.id}`}
			className="flex flex-col gap-8 rounded-md border border-line bg-surface p-6 text-body text-fg md:p-10"
		>
			<header className="flex flex-wrap justify-between gap-4">
				<span>
					<Image
						src="/majeurs-logo-black.png"
						alt="Majeurs"
						width={180}
						height={28}
						className="dark:hidden"
					/>
					<Image
						src="/majeurs-logo-white.png"
						alt="Majeurs"
						width={180}
						height={28}
						className="hidden dark:block"
					/>
				</span>
				<div className="flex flex-col gap-1 sm:items-end sm:text-end">
					<span className="text-overline font-bold tracking-[0.06em] text-accent-fg uppercase">
						Invoice
					</span>
					<strong>{invoice.id}</strong>
					<span className="text-small text-fg-secondary">
						Issued {issuedLabel(invoice).split(",")[0]} by {invoice.createdBy}
						<br />
						Quote {invoice.quoteNumber} v{invoice.quoteVersion}
					</span>
				</div>
			</header>

			<div className="grid gap-6 sm:grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
				<div className="flex flex-col gap-1">
					<span className="text-overline font-bold tracking-[0.06em] text-fg-secondary uppercase">
						Bill to
					</span>
					<strong>{billTo.name}</strong>
					<span className="text-small text-fg-secondary">
						{billTo.address}
						{billTo.address && billTo.email && <br />}
						{billTo.email}
					</span>
				</div>
				<div className="flex flex-col gap-1">
					<span className="text-overline font-bold tracking-[0.06em] text-fg-secondary uppercase">
						Payment
					</span>
					<span className="text-small text-fg-secondary">
						{bank.ngnBank && bank.ngnAccountNumber ? (
							<>
								Bank transfer · {bank.ngnBank} · {bank.ngnAccountNumber}
								{bank.ngnAccountName && ` · ${bank.ngnAccountName}`}
								{bank.usdBank && bank.usdAccountNumber && (
									<>
										<br />
										USD: {bank.usdBank} · {bank.usdAccountNumber}
										{bank.swift && ` · SWIFT ${bank.swift}`}
									</>
								)}
							</>
						) : (
							"Bank details aren't set yet. Add them in Settings → Bank & terms."
						)}
						<br />
						Use the invoice number as the reference.
					</span>
				</div>
			</div>

			<Table className="min-w-130 [&_th]:border-b [&_th]:border-line-control [&_th]:bg-transparent">
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
					{lines.map((l, i) => (
						<tr key={i}>
							<td className="align-top">
								<span className="flex flex-col">
									<span className="font-bold text-fg">{l.name}</span>
									<span className="text-small text-fg-tertiary">{l.desc}</span>
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
				<dl className="flex w-85 max-w-full flex-col gap-2">
					<Row label="Subtotal" value={formatNaira(sub)} />
					<Row label={`VAT (${+(vatRate * 100).toFixed(2)}%)`} value={formatNaira(vat)} />
					<div className="flex justify-between gap-3 border-t border-line pt-2 font-bold">
						<dt>Total</dt>
						<dd className="tabular">{formatNaira(invoice.total)}</dd>
					</div>
					{payments.map((p) => (
						<Row
							key={p.id}
							label={p.label}
							value={`− ${formatNaira(p.amount)}`}
							tone="paid"
						/>
					))}
					<div className="flex items-baseline justify-between gap-3 border-t border-line pt-2 font-bold">
						<dt>Balance due</dt>
						<dd className="font-display text-total tabular">{formatNaira(balance)}</dd>
					</div>
				</dl>
			</div>

			<footer className="border-t border-line pt-5 text-small text-fg-secondary">
				{footer ||
					"The balance is due before delivery. Delivery is scheduled once production is complete."}
			</footer>
		</article>
	);
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "paid" }) {
	return (
		<div className="flex justify-between gap-3">
			<dt className="text-fg-secondary">{label}</dt>
			<dd className={tone === "paid" ? "text-success-fg tabular" : "tabular"}>{value}</dd>
		</div>
	);
}
