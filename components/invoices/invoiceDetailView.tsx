"use client";

import { useState } from "react";
import Link from "next/link";
import dayjs from "dayjs";
import { Download, Send } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Card } from "@/components/common/card";
import { Badge } from "@/components/common/badge";
import { Button } from "@/components/common/buttons";
import PageTitle from "@/components/layout/pageTitle";
import PageWrapper from "@/components/layout/pageWrapper";
import { formatNaira } from "@/lib/currency";
import {
	INVOICE_STATUS,
	issuedLabel,
	type InvoiceDetail,
	type InvoicePayment,
} from "@/lib/invoices";
import InvoiceDocument from "./invoiceDocument";
import RecordPaymentForm from "./recordPaymentForm";

const initialsOf = (name: string) =>
	name
		.split(/\s+/)
		.map((w) => w[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();

export default function InvoiceDetailView({
	detail,
	others,
	canRecordPayment,
	recordedBy,
}: {
	detail: InvoiceDetail;
	/** The other invoices, for the "Other invoices" list. */
	others: { id: string; client: string; status: "part" | "paid" }[];
	canRecordPayment: boolean;
	/** Name shown against a payment recorded in this session. */
	recordedBy: string;
}) {
	const { invoice, billTo } = detail;
	// TODO: record through the backend once it exists; for now it only changes this page.
	const [recorded, setRecorded] = useState<InvoicePayment[]>([]);
	const payments = [...invoice.payments, ...recorded];
	const paid = payments.reduce((sum, p) => sum + p.amount, 0);
	const balance = Math.max(0, invoice.total - paid);
	const status = INVOICE_STATUS[balance === 0 ? "paid" : "part"];

	const recordPayment = ({ amount, reference }: { amount: number; reference: string }) => {
		const settles = amount >= balance;
		setRecorded((list) => [
			...list,
			{
				label: settles ? "Balance" : "Part payment",
				date: dayjs().format("YYYY-MM-DD"),
				recordedBy,
				amount,
			},
		]);
		toast.success(
			settles
				? `Balance recorded (ref ${reference}). Paid in full.`
				: `${formatNaira(amount)} recorded (ref ${reference}).`,
		);
	};

	return (
		<PageWrapper>
			<PageTitle
				breadcrumbs={[{ label: "Invoices", href: "/invoices" }, { label: invoice.id }]}
				pageTitle={invoice.client}
				badge={{ label: status.label, variant: status.tone }}
				pageDescription={[
					invoice.id,
					`Created by ${invoice.createdBy} (${invoice.createdByRole}), ${issuedLabel(invoice)}`,
					`From quote ${invoice.quoteNumber} v${invoice.quoteVersion}`,
					detail.jobCard && `Job card ${detail.jobCard}`,
				]
					.filter(Boolean)
					.join(" · ")}
				actions={
					<>
						<Button disabled title="PDF export isn't built yet">
							<Download />
							Download PDF
						</Button>
						<Button
							disabled
							title={
								billTo.email
									? "Emailing invoices isn't connected yet"
									: "This client has no email address"
							}
						>
							<Send />
							Email to client
						</Button>
					</>
				}
			/>

			<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
				<div className="min-w-0">
					<InvoiceDocument detail={detail} payments={payments} balance={balance} />
				</div>

				<aside aria-label="Invoice summary" className="flex min-w-0 flex-col gap-6">
					<Card aria-labelledby="details-title">
						<h2 id="details-title">Details</h2>
						<dl className="flex flex-col gap-3 text-body">
							<Detail label="Created by">
								<span className="flex items-center gap-2">
									<Avatar
										initials={initialsOf(invoice.createdBy)}
										className="size-6 text-xs"
									/>
									{invoice.createdBy}, {invoice.createdByRole}
								</span>
							</Detail>
							<Detail label="Created">{issuedLabel(invoice)}</Detail>
							<Detail label="How">Deposit recorded on quote</Detail>
							<Detail label="Quote">
								<Link href={`/quotes/${invoice.quoteNumber}`}>
									{invoice.quoteNumber} v{invoice.quoteVersion}
								</Link>
							</Detail>
							{detail.quotePreparedBy && (
								<Detail label="Quote prepared by">{detail.quotePreparedBy}</Detail>
							)}
							{detail.lastSentLabel && (
								<Detail label="Last sent to client">{detail.lastSentLabel}</Detail>
							)}
						</dl>
					</Card>

					<Card aria-labelledby="payments-title">
						<h2 id="payments-title">Payments</h2>
						<ul className="flex flex-col">
							{payments.map((p) => (
								<li
									key={`${p.label}-${p.date}-${p.amount}`}
									className="flex items-start justify-between gap-3 border-t border-line py-3 first:border-t-0 first:pt-0"
								>
									<span className="flex flex-col">
										<strong className="text-fg">{p.label}</strong>
										<span className="text-small text-fg-tertiary">
											{dayjs(p.date).format("D MMM YYYY")} · recorded by{" "}
											{p.recordedBy}
										</span>
									</span>
									<strong className="whitespace-nowrap text-fg tabular">
										{formatNaira(p.amount)}
									</strong>
								</li>
							))}
						</ul>

						{balance > 0 &&
							(canRecordPayment ? (
								<>
									<hr className="border-line" />
									<RecordPaymentForm
										// a fresh form, with the new balance, after each payment
										key={balance}
										balance={balance}
										onRecord={recordPayment}
									/>
								</>
							) : (
								<p className="text-small text-fg-tertiary">
									{formatNaira(balance)} is still due. Accounting records payments
									once the transfer lands.
								</p>
							))}

						{balance === 0 && (
							<div
								role="status"
								className="rounded-md border border-success-line bg-success-subtle px-4 py-3 text-body text-fg"
							>
								<strong>Paid in full.</strong> Production can release the order for
								delivery.
							</div>
						)}
					</Card>

					{others.length > 0 && (
						<Card flush aria-labelledby="others-title">
							<div className="border-b border-line px-5 py-4">
								<h2 id="others-title">Other invoices</h2>
							</div>
							<ul className="px-5">
								{others.map((o) => (
									<li
										key={o.id}
										className="flex items-center gap-3 border-t border-line py-3 first:border-t-0"
									>
										<span className="flex min-w-0 flex-1 flex-col">
											<Link
												href={`/invoices/${o.id}`}
												className="font-bold text-fg no-underline hover:underline"
											>
												{o.client}
											</Link>
											<span className="text-small text-fg-tertiary">
												{o.id}
											</span>
										</span>
										<Badge variant={INVOICE_STATUS[o.status].tone}>
											{INVOICE_STATUS[o.status].label}
										</Badge>
									</li>
								))}
							</ul>
						</Card>
					)}
				</aside>
			</div>
		</PageWrapper>
	);
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
			<dt className="text-fg-secondary">{label}</dt>
			<dd className="text-end text-fg">{children}</dd>
		</div>
	);
}
