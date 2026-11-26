"use client";

import { formatNaira } from "@/lib/currency";
import { useId, useState } from "react";
import Link from "next/link";
import dayjs from "dayjs";
import { Download, MessageCircle, Phone, Trash2 } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { Badge } from "@/components/common/badge";
import { Button } from "@/components/common/buttons";
import { Drawer } from "@/components/common/drawer";
import { FormField } from "@/components/forms";
import type { FormFieldConfig } from "@/components/forms/types";
import PartThumb from "@/components/inventory/partThumb";
import { DataTable, IconButton, IconLink, type ColumnDef } from "@/components/tables";
import {
	APPROVERS,
	PO_STATUS,
	money,
	poDate,
	poTotal,
	unitQty,
	type DeliveryQuality,
	type POLine,
	type PurchaseOrder,
} from "@/lib/purchaseOrders";
import type { Supplier } from "@/lib/suppliers";
import { downloadPurchaseOrderPdf } from "./purchaseOrderPdf";

const QUALITY: DeliveryQuality[] = ["As ordered", "Minor issues", "Rejected some"];

type LineRow = POLine & { id: string };
type DeliveryValues = Record<string, string>;

const nowKey = (sku: string) => `now:${sku}`;
const whole = (v: unknown) => {
	const n = Number(v);
	return Number.isInteger(n) && n >= 0 ? n : 0;
};

const lineColumns: ColumnDef<LineRow>[] = [
	{
		key: "part",
		header: "Part",
		cell: (l) => (
			<span className="flex min-w-40 items-center gap-3">
				<PartThumb part={l} />
				<span className="flex flex-col">
					<strong className="text-fg">{l.name}</strong>
					<span className="text-small text-fg-tertiary">{l.sku}</span>
				</span>
			</span>
		),
	},
	{
		key: "ordered",
		header: "Ordered",
		className: "text-end whitespace-nowrap tabular",
		cell: (l) => unitQty(l.ordered, l.unit),
	},
	{
		key: "received",
		header: "Received",
		className: "text-end whitespace-nowrap tabular",
		cell: (l) => <strong className="text-fg">{unitQty(l.received, l.unit)}</strong>,
	},
	{
		key: "unitCost",
		header: "Unit cost",
		className: "text-end whitespace-nowrap tabular",
		cell: (l) => money(l.unitCost),
	},
	{
		key: "line",
		header: "Line",
		className: "text-end whitespace-nowrap tabular",
		cell: (l) => <strong className="text-fg">{money(l.ordered * l.unitCost)}</strong>,
	},
];

/** One purchase order: its lines and, depending on status, send, approve or record a delivery. */
export default function PurchaseOrderDrawer({
	po,
	supplier,
	today,
	canApprove,
	approvalLimit,
	onSend,
	onApprove,
	onRecordDelivery,
	onDelete,
	onClose,
}: {
	po: PurchaseOrder;
	supplier: Supplier | undefined;
	today: string;
	/** MD and GM can approve orders over the limit. */
	canApprove: boolean;
	approvalLimit: number;
	onSend: () => void;
	onApprove: () => void;
	onRecordDelivery: (
		received: Record<string, number>,
		date: string,
		quality: DeliveryQuality,
	) => void;
	onDelete: () => void;
	onClose: () => void;
}) {
	const formId = useId();
	const receivable = po.status === "sent" || po.status === "part";
	const [downloading, setDownloading] = useState(false);

	const { control, register, getValues, setValue, handleSubmit, formState } =
		useForm<DeliveryValues>({
			mode: "onTouched",
			defaultValues: {
				...Object.fromEntries(
					po.lines.map((l) => [
						nowKey(l.sku),
						String(Math.max(0, l.ordered - l.received)),
					]),
				),
				date: dayjs(today).toISOString(),
				quality: QUALITY[0],
			},
		});
	const values = useWatch({ control }) as DeliveryValues;
	const nothingReceived = po.lines.every((l) => whole(values[nowKey(l.sku)]) === 0);

	const field = (config: FormFieldConfig) => (
		<FormField
			key={config.name}
			field={{ ...config, id: `${formId}-${config.name}` }}
			register={register}
			control={control}
			getValues={getValues}
			setValue={setValue}
			errors={formState.errors}
			hideRequiredMark
		/>
	);

	const digits = supplier?.phone.replace(/\D/g, "") ?? "";
	const status = PO_STATUS[po.status];

	return (
		<Drawer
			title={
				<span className="flex flex-col gap-1">
					<span className="text-small font-normal text-fg-tertiary">{po.number}</span>
					<span className="flex flex-wrap items-center gap-2">
						{supplier?.business ?? "Unknown supplier"}
						<Badge variant={status.tone}>{status.label}</Badge>
					</span>
				</span>
			}
			description={
				<>
					Raised by {po.raisedBy} · {poDate(po.date)} ·{" "}
					{po.jobCard ? (
						<>
							For <Link href={`/work-orders/${po.jobCard}`}>{po.jobCard}</Link>
							{po.client ? ` (${po.client})` : ""}
						</>
					) : (
						"Restock"
					)}
				</>
			}
			onClose={onClose}
			footer={
				<>
					<IconButton
						aria-label={`Download ${po.number} as PDF`}
						title="Download PDF"
						disabled={downloading}
						onClick={async () => {
							setDownloading(true);
							try {
								await downloadPurchaseOrderPdf(po, supplier);
							} finally {
								setDownloading(false);
							}
						}}
					>
						<Download aria-hidden="true" />
					</IconButton>
					{po.status === "draft" && (
						<IconButton
							danger
							aria-label={`Delete draft ${po.number}`}
							title="Delete draft"
							onClick={onDelete}
						>
							<Trash2 aria-hidden="true" />
						</IconButton>
					)}
					<span className="flex-1" />
					<Button onClick={onClose}>Close</Button>
					{po.status === "draft" && (
						<Button variant="primary" onClick={onSend}>
							Send to supplier
						</Button>
					)}
					{po.status === "approval" && canApprove && (
						<Button variant="primary" onClick={onApprove}>
							Approve and send
						</Button>
					)}
					{receivable && (
						<Button
							type="submit"
							form={formId}
							variant="primary"
							disabled={nothingReceived}
						>
							Record delivery
						</Button>
					)}
				</>
			}
		>
			{supplier && (
				<div className="flex items-center gap-1 rounded-md bg-subtle p-3">
					<span className="flex min-w-0 flex-1 flex-col">
						<strong className="text-fg">{supplier.contact}</strong>
						<span className="text-small text-fg-secondary">{supplier.phone}</span>
					</span>
					<IconLink
						href={`tel:+${digits}`}
						aria-label={`Call ${supplier.contact}`}
						title="Call"
					>
						<Phone aria-hidden="true" />
					</IconLink>
					<IconLink
						href={`https://wa.me/${digits}`}
						target="_blank"
						rel="noopener noreferrer"
						aria-label={`Message ${supplier.contact} on WhatsApp`}
						title="WhatsApp"
					>
						<MessageCircle aria-hidden="true" />
					</IconLink>
				</div>
			)}

			{po.status === "approval" && (
				<p
					role="status"
					className="rounded-md border border-warning-line bg-warning-subtle p-3 text-body text-fg"
				>
					<strong>Waiting for approval.</strong> Over {formatNaira(approvalLimit)}, so{" "}
					{APPROVERS} must approve before it&apos;s sent.
					{po.approvalRequested && ` Requested ${po.approvalRequested}.`}
				</p>
			)}

			<DataTable
				tableId={`po-${po.number}`}
				compact
				columns={lineColumns}
				rows={po.lines.map((l) => ({ ...l, id: l.sku }))}
			/>

			<div className="flex items-center justify-between text-lg">
				<span className="text-fg-secondary">Total</span>
				<strong className="tabular">{money(poTotal(po))}</strong>
			</div>

			{po.deliveredOn && po.status !== "draft" && (
				<p className="text-small text-fg-secondary">
					Last delivery {poDate(po.deliveredOn)}
					{po.quality ? ` · ${po.quality.toLowerCase()}` : ""}.
				</p>
			)}

			{receivable && (
				<form
					id={formId}
					noValidate
					aria-labelledby={`${formId}-title`}
					onSubmit={handleSubmit((v) =>
						onRecordDelivery(
							Object.fromEntries(
								po.lines.map((l) => [l.sku, whole(v[nowKey(l.sku)])]),
							),
							dayjs(v.date).format("YYYY-MM-DD"),
							v.quality as DeliveryQuality,
						),
					)}
					className="flex flex-col gap-4 border-t border-line pt-4"
				>
					<h3 id={`${formId}-title`} className="text-h3">
						Record a delivery
					</h3>
					<div className="grid gap-4 sm:grid-cols-2">
						{po.lines.map((l) => {
							const left = l.ordered - l.received;
							return field({
								name: nowKey(l.sku),
								type: "text",
								label: `${l.name} received now (${l.unit}s)`,
								inputMode: "numeric",
								description:
									left > 0
										? `${unitQty(left, l.unit)} still to come`
										: "All received",
								validation: {
									validate: (v: string) =>
										!/^\d+$/.test(String(v ?? "").trim())
											? "Enter a whole number"
											: Number(v) <= left ||
												`More than the ${unitQty(left, l.unit)} still to come`,
								},
							});
						})}
						{field({
							name: "date",
							type: "date",
							label: "Delivery date",
							maxDate: today,
							validation: { required: "Pick the delivery date" },
						})}
					</div>
					{field({
						name: "quality",
						type: "radio",
						label: "Quality on arrival",
						description:
							"Feeds the supplier's reliability rating with on-time delivery.",
						options: QUALITY.map((q) => ({ label: q, value: q })),
					})}
				</form>
			)}
		</Drawer>
	);
}
