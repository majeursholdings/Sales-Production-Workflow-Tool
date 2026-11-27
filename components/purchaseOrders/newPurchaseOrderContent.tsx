"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Badge } from "@/components/common/badge";
import { Button } from "@/components/common/buttons";
import { Card } from "@/components/common/card";
import { ConfirmDialog } from "@/components/common/modal";
import { FormField } from "@/components/forms";
import type { FormFieldConfig } from "@/components/forms/types";
import PartThumb from "@/components/inventory/partThumb";
import PageTitle from "@/components/layout/pageTitle";
import { DataTable, IconButton, TableState, type ColumnDef } from "@/components/tables";
import {
	availableOf,
	costLabel,
	shortfallsOf,
	suggestOrders,
	type Inventory,
	type Part,
} from "@/lib/inventory";
import { createPurchaseOrdersAction } from "@/app/(dashboard)/purchase-orders/actions";
import {
	APPROVERS_BOTH,
	PAYMENT_TERMS,
	PICKUP,
	deliverToOptions,
	addWorkingDays,
	money,
	needsApproval,
	skusOnOrder,
	unitQty,
	type PurchaseOrder,
} from "@/lib/purchaseOrders";
import type { DeliveryAddress } from "@/lib/companySettings";
import {
	formatScore,
	materialOf,
	plural,
	supplierRating,
	type SupplierCatalog,
} from "@/lib/suppliers";

type Values = Record<string, string | boolean>;

const qtyKey = (supplierId: string, sku: string) => `qty:${supplierId}:${sku}`;
const costKey = (supplierId: string, sku: string) => `cost:${supplierId}:${sku}`;
const whole = (v: unknown) => {
	const n = Number(v);
	return Number.isInteger(n) && n > 0 ? n : 0;
};

/** A line on the order, with what inventory knows about the part. */
type LineRow = {
	id: string;
	sku: string;
	name: string;
	unit: string;
	spec: string;
	part: Part | undefined;
	/** Units short for confirmed job cards. */
	short: number;
};

/** Pick a supplier, set what to order from them, then save a draft or send it. */
export default function NewPurchaseOrderContent({
	orders,
	inventory,
	catalog,
	today,
	userName,
	initialSupplierId,
	approvalLimit,
	deliveryAddresses,
}: {
	orders: PurchaseOrder[];
	inventory: Inventory;
	catalog: SupplierCatalog;
	today: string;
	userName: string;
	/** From ?supplier=, e.g. when started from a supplier's page. */
	initialSupplierId?: string;
	approvalLimit: number;
	/** Settings → Company details. */
	deliveryAddresses: DeliveryAddress[];
}) {
	const router = useRouter();
	const formId = useId();
	const shortfalls = shortfallsOf(inventory);
	const suggested = suggestOrders(inventory, catalog);
	const onOrder = skusOnOrder(orders);
	const jobs = [...new Map(shortfalls.map((s) => [s.jobCard, s.client]))];
	const deliverTo = deliverToOptions(deliveryAddresses);

	/** What to order from a supplier by default: their parts that need ordering and aren't on an order yet. */
	const defaultsFor = (id: string) =>
		(suggested.find((g) => g.supplierId === id)?.lines ?? []).filter(
			(l) => !onOrder.has(l.sku),
		);
	const supplierOf = (id: string) => catalog.suppliers.find((s) => s.id === id);
	const leadFor = (id: string, skus: string[]) => {
		const materials = supplierOf(id)?.materials ?? [];
		const onLines = materials.filter((m) => skus.includes(m.sku)).map((m) => m.leadDays);
		return Math.max(0, ...onLines) || Math.min(...materials.map((m) => m.leadDays), 5);
	};
	const jobFor = (skus: string[]) => shortfalls.find((s) => skus.includes(s.sku))?.jobCard ?? "";

	const [firstSupplier] = useState(
		() =>
			(initialSupplierId && supplierOf(initialSupplierId)
				? initialSupplierId
				: suggested.find((g) => defaultsFor(g.supplierId).length > 0)?.supplierId) ??
			catalog.suppliers[0]?.id ??
			"",
	);
	/** Which parts are on the order, per supplier: edits survive switching back and forth. */
	const [skus, setSkus] = useState<Record<string, string[]>>(() => ({
		[firstSupplier]: defaultsFor(firstSupplier).map((l) => l.sku),
	}));
	const [removing, setRemoving] = useState<string | null>(null);

	const firstSkus = skus[firstSupplier] ?? [];
	const form = useForm<Values>({
		mode: "onTouched",
		defaultValues: {
			supplierId: firstSupplier,
			...Object.fromEntries(
				defaultsFor(firstSupplier).flatMap((l) => [
					[qtyKey(firstSupplier, l.sku), String(l.qty)],
					[costKey(firstSupplier, l.sku), String(l.price)],
				]),
			),
			expected: dayjs(addWorkingDays(today, leadFor(firstSupplier, firstSkus))).toISOString(),
			deliverTo: deliverTo[0],
			job: jobFor(firstSkus),
			terms: PAYMENT_TERMS[0],
			note: "",
			viaWhatsapp: true,
			viaEmail: !!supplierOf(firstSupplier)?.email,
			attachPhotos: true,
		},
	});
	const { control, register, getValues, setValue, handleSubmit, formState } = form;
	const values = useWatch({ control }) as Values;

	const supplierId = String(values.supplierId ?? firstSupplier);
	const supplier = supplierOf(supplierId);
	const rating = supplier ? supplierRating(supplier) : null;
	const lineSkus = skus[supplierId] ?? [];
	const lead = leadFor(supplierId, lineSkus);
	const pickup = values.deliverTo === PICKUP;

	const priceOf = (sku: string) => supplier?.materials.find((m) => m.sku === sku)?.price ?? 0;
	const qtyOf = (sku: string) => whole(values[qtyKey(supplierId, sku)]);
	const costOf = (sku: string) => Number(values[costKey(supplierId, sku)] ?? 0) || 0;
	const total = lineSkus.reduce((sum, sku) => sum + qtyOf(sku) * costOf(sku), 0);
	const approval = needsApproval(total, approvalLimit);

	const rows: LineRow[] = lineSkus.map((sku) => {
		const part = inventory.parts.find((p) => p.sku === sku);
		const material = materialOf(catalog, sku);
		return {
			id: sku,
			sku,
			name: part?.name ?? material.name,
			unit: part?.unit ?? material.unit,
			spec: part?.spec ?? "",
			part,
			short: shortfalls.filter((s) => s.sku === sku).reduce((n, s) => n + s.short, 0),
		};
	});
	const addable = (supplier?.materials ?? []).filter((m) => !lineSkus.includes(m.sku));

	/** Fills in a line's quantity and cost the first time it's on this supplier's order. */
	const seed = (id: string, sku: string, qty: number, cost: number) => {
		if (getValues(qtyKey(id, sku)) === undefined) setValue(qtyKey(id, sku), String(qty));
		if (getValues(costKey(id, sku)) === undefined) setValue(costKey(id, sku), String(cost));
	};

	const pickSupplier = (id: string) => {
		if (!id) return;
		const next = skus[id] ?? defaultsFor(id).map((l) => l.sku);
		if (!skus[id]) {
			defaultsFor(id).forEach((l) => seed(id, l.sku, l.qty, l.price));
			setSkus((s) => ({ ...s, [id]: next }));
		}
		setValue("expected", dayjs(addWorkingDays(today, leadFor(id, next))).toISOString());
		setValue("job", jobFor(next));
		setValue("viaEmail", !!supplierOf(id)?.email);
	};

	const addLine = (sku: string) => {
		seed(
			supplierId,
			sku,
			inventory.parts.find((p) => p.sku === sku)?.reorderLevel || 1,
			priceOf(sku),
		);
		setSkus((s) => ({ ...s, [supplierId]: [...lineSkus, sku] }));
	};

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

	const columns: ColumnDef<LineRow>[] = [
		{
			key: "part",
			header: "Part",
			cell: (r) => (
				<span className="flex min-w-48 items-center gap-3">
					<PartThumb part={{ sku: r.sku, photoUrl: r.part?.photoUrl }} />
					<span className="flex min-w-0 flex-col">
						<strong className="text-fg">{r.name}</strong>
						<span className="text-small text-fg-tertiary">
							{[r.sku, r.spec].filter(Boolean).join(" · ")}
						</span>
					</span>
				</span>
			),
		},
		{
			key: "stock",
			header: "Stock",
			cell: (r) => {
				if (!r.part) return <Badge>Not in inventory</Badge>;
				const avail = availableOf(r.part);
				const atLevel = avail <= r.part.reorderLevel;
				return (
					<Badge variant={r.short || atLevel ? "warning" : "neutral"}>
						{Math.max(0, avail)} available
						{r.short
							? ` · ${unitQty(r.short, r.unit)} short`
							: atLevel
								? " · at reorder level"
								: ""}
					</Badge>
				);
			},
		},
		{
			key: "qty",
			header: "Quantity",
			cell: (r) => {
				const key = qtyKey(supplierId, r.sku);
				const qty = qtyOf(r.sku);
				const step = (n: number) => setValue(key, String(n), { shouldValidate: true });
				return (
					<span className="flex items-start gap-1">
						<IconButton
							aria-label={`Fewer ${r.name}`}
							disabled={qty <= 1}
							onClick={() => step(qty - 1)}
							className="mt-1"
						>
							<Minus aria-hidden="true" />
						</IconButton>
						<span className="w-16">
							{field({
								name: key,
								type: "text",
								label: `${r.name} quantity`,
								hideLabel: true,
								inputMode: "numeric",
								className: "[&_input]:text-center",
								validation: {
									validate: (v: string) => whole(v) > 0 || "Enter a quantity",
								},
							})}
						</span>
						<IconButton
							aria-label={`More ${r.name}`}
							onClick={() => step(qty + 1)}
							className="mt-1"
						>
							<Plus aria-hidden="true" />
						</IconButton>
						<span className="ms-1 pt-2.5 text-small text-fg-secondary">
							{qty === 1 ? r.unit : `${r.unit}s`}
						</span>
					</span>
				);
			},
		},
		{
			key: "cost",
			header: "Unit cost",
			className: "w-40",
			cell: (r) =>
				field({
					name: costKey(supplierId, r.sku),
					type: "amount",
					label: `Unit cost for ${r.name}`,
					hideLabel: true,
					currencySymbol: "₦",
					className: "[&_input]:text-end",
					validation: { validate: (v: string) => Number(v) > 0 || "Enter a cost" },
				}),
		},
		{
			key: "line",
			header: "Line total",
			className: "text-end",
			cell: (r) => (
				<strong className="whitespace-nowrap text-fg tabular">
					{money(qtyOf(r.sku) * costOf(r.sku))}
				</strong>
			),
		},
		{
			key: "remove",
			header: <span className="sr-only">Remove</span>,
			className: "w-12 text-end",
			cell: (r) => (
				<IconButton
					danger
					aria-label={`Remove ${r.name}`}
					title="Remove line"
					onClick={() => setRemoving(r.sku)}
				>
					<Trash2 aria-hidden="true" />
				</IconButton>
			),
		},
	];

	const save = (send: boolean) => async (v: Values) => {
		if (!supplier || rows.length === 0) return;
		const job = String(v.job ?? "");
		const result = await createPurchaseOrdersAction([
			{
				supplierId,
				lines: rows.map((r) => ({
					sku: r.sku,
					name: r.name,
					unit: r.unit,
					ordered: qtyOf(r.sku),
					unitCost: costOf(r.sku),
				})),
				send,
				expected: send ? dayjs(String(v.expected)).format("YYYY-MM-DD") : null,
				jobCard: job || null,
				client: jobs.find(([j]) => j === job)?.[1] ?? null,
				deliverTo: String(v.deliverTo),
				paymentTerms: String(v.terms),
				note: String(v.note ?? "").trim(),
			},
		]);
		if (!result.ok) {
			toast.error(result.message);
			return;
		}
		const [{ number, status }] = result.data;
		toast.success(
			status === "draft"
				? `Draft ${number} saved. It isn't sent until you press Send.`
				: status === "approval"
					? `Sent to ${APPROVERS_BOTH} for approval. ${supplier.business} gets it once approved.`
					: `${number} marked as sent to ${supplier.business}. Accounting has a copy.`,
		);
		router.push("/purchase-orders");
	};

	const removingRow = rows.find((r) => r.sku === removing);

	return (
		<>
			<PageTitle
				pageTitle="New purchase order"
				pageDescription={`Draft · raised by ${userName}`}
				breadcrumbs={[
					{ label: "Purchase orders", href: "/purchase-orders" },
					{ label: "New purchase order" },
				]}
				actions={
					<>
						<Button disabled={rows.length === 0} onClick={handleSubmit(save(false))}>
							Save draft
						</Button>
						<Button
							variant="primary"
							disabled={rows.length === 0}
							onClick={handleSubmit(save(true))}
						>
							{approval ? "Send for approval" : "Send to supplier"}
						</Button>
					</>
				}
			/>

			<form
				id={formId}
				noValidate
				onSubmit={handleSubmit(save(true))}
				className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)] lg:items-start"
			>
				<div className="flex min-w-0 flex-col gap-6">
					<Card aria-labelledby={`${formId}-supplier`} className="gap-4">
						<h2 id={`${formId}-supplier`}>Supplier</h2>
						{field({
							name: "supplierId",
							type: "combobox",
							label: "Supplier",
							hideLabel: true,
							placeholder: "Search suppliers",
							options: catalog.suppliers.map((s) => {
								const r = supplierRating(s);
								return {
									value: s.id,
									label: `${s.business} · ${r === null ? "not rated yet" : `rated ${formatScore(r)}`}`,
								};
							}),
							onValueChange: pickSupplier,
							validation: { required: "Pick a supplier" },
						})}
						{supplier && (
							<p className="text-small text-fg-secondary">
								Supplies{" "}
								{supplier.materials
									.map((m) => materialOf(catalog, m.sku).name)
									.join(", ") || "nothing in inventory yet"}
								.
							</p>
						)}
						{supplier && rating !== null && rating < 3 && (
							<p
								role="status"
								className="rounded-md border border-warning-line bg-warning-subtle px-4 py-3 text-body text-fg"
							>
								{supplier.business} is rated {formatScore(rating)} and delivered on
								time {supplier.onTimePercent}% of the time. Allow extra time before
								the job card needs these parts.
							</p>
						)}
					</Card>

					<div className="flex flex-col gap-3">
						<DataTable
							tableId="new-po-lines"
							columns={columns}
							rows={rows}
							toolbar={
								<div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
									<h2 className="flex-1">What you&apos;re ordering</h2>
									<span className="text-small text-fg-secondary">
										Parts this supplier is linked to
									</span>
								</div>
							}
							emptyState={
								<TableState
									kind="empty"
									compact
									title="No parts on this order yet"
									description="Add one of this supplier's parts below."
								/>
							}
						/>
						<div className="flex flex-wrap items-center gap-2">
							<span className="flex-[1_1_200px] text-small text-fg-secondary">
								Unit costs start from this supplier&apos;s last price.
							</span>
							{addable.map((m) => (
								<Button key={m.sku} size="sm" onClick={() => addLine(m.sku)}>
									<Plus />
									Add{" "}
									{(
										inventory.parts.find((p) => p.sku === m.sku)?.name ??
										materialOf(catalog, m.sku).name
									).toLowerCase()}
								</Button>
							))}
						</div>
					</div>

					<Card aria-labelledby={`${formId}-delivery`} className="gap-4">
						<h2 id={`${formId}-delivery`}>Delivery and notes</h2>
						<div className="grid gap-4 sm:grid-cols-2">
							{field({
								name: "expected",
								type: "date",
								label: pickup ? "Pickup date" : "Expected delivery",
								minDate: today,
								description: pickup
									? `Usually ready in ${plural(lead, "working day")}.`
									: `Usually delivers in ${plural(lead, "working day")}.`,
								validation: { required: "Pick a date" },
							})}
							{field({
								name: "deliverTo",
								type: "select",
								label: "Deliver to",
								options: deliverTo.map((d) => ({ label: d, value: d })),
								validation: { required: "Pick where it goes" },
							})}
							{field({
								name: "job",
								type: "select",
								label: "For job card (optional)",
								placeholder: "Restock, no job card",
								description: "Linked parts are reserved for it when they arrive.",
								options: jobs.map(([j, client]) => ({
									label: `${j} · ${client}`,
									value: j,
								})),
							})}
							{field({
								name: "terms",
								type: "select",
								label: "Payment terms",
								options: PAYMENT_TERMS.map((t) => ({ label: t, value: t })),
								validation: { required: "Pick the payment terms" },
							})}
						</div>
						{deliveryAddresses.length === 0 && (
							<p className="text-small text-fg-secondary">
								No delivery addresses saved yet.{" "}
								<Link
									href="/settings/company"
									className="font-bold text-accent-fg hover:underline"
								>
									Add them in Settings → Company details
								</Link>
								.
							</p>
						)}
						{field({
							name: "note",
							type: "textarea",
							label: "Note to the supplier (optional)",
							placeholder:
								"e.g. Kiln-dried only, moisture under 12%. Send photos before dispatch.",
							rows: 3,
						})}
					</Card>
				</div>

				<aside className="flex flex-col gap-6">
					<Card aria-labelledby={`${formId}-total`}>
						<h2 id={`${formId}-total`}>Order total</h2>
						<div className="flex justify-between text-body">
							<span className="text-fg-secondary">{plural(rows.length, "line")}</span>
							<span className="tabular">{money(total)}</span>
						</div>
						<div className="flex justify-between text-body">
							<span className="text-fg-secondary">
								{pickup ? "Pickup" : "Delivery"}
							</span>
							<span>{pickup ? "We collect" : "Included"}</span>
						</div>
						<hr className="border-line" />
						<div className="flex items-baseline justify-between font-bold">
							<span>Total</span>
							<span className="text-lg tabular">{money(total)}</span>
						</div>
						{approval && (
							<p
								role="status"
								className="rounded-md border border-warning-line bg-warning-subtle px-4 py-3 text-body text-fg"
							>
								<strong>Needs approval.</strong> Orders over{" "}
								{costLabel(approvalLimit)} go to the MD or GM before the supplier
								sees them.
							</p>
						)}
					</Card>

					{supplier && (
						<Card aria-labelledby={`${formId}-send`}>
							<h2 id={`${formId}-send`}>Send to {supplier.business}</h2>
							{field({
								name: "viaWhatsapp",
								type: "checkbox",
								label: (
									<span className="flex flex-col">
										WhatsApp
										<span className="text-small text-fg-secondary">
											{supplier.phone} · PDF and a short message
										</span>
									</span>
								),
							})}
							{field({
								name: "viaEmail",
								type: "checkbox",
								disabled: !supplier.email,
								label: (
									<span className="flex flex-col">
										Email
										<span className="text-small text-fg-secondary">
											{supplier.email || "No email on file"}
										</span>
									</span>
								),
							})}
							<hr className="border-line" />
							{field({
								name: "attachPhotos",
								type: "checkbox",
								label: (
									<span className="flex flex-col">
										Attach part photos
										<span className="text-small text-fg-secondary">
											Each line on the PDF shows its photo, so the supplier
											sends exactly the right item.
										</span>
									</span>
								),
							})}
							<p className="text-small text-fg-secondary">
								Accounting gets a copy so they can plan the payment.
							</p>
						</Card>
					)}
				</aside>
			</form>

			{removingRow && (
				<ConfirmDialog
					title={`Remove ${removingRow.name.toLowerCase()} from this order?`}
					confirmLabel="Remove line"
					onConfirm={() => {
						setSkus((s) => ({
							...s,
							[supplierId]: lineSkus.filter((sku) => sku !== removingRow.sku),
						}));
						setRemoving(null);
					}}
					onCancel={() => setRemoving(null)}
				>
					{removingRow.short
						? "This part is short for a confirmed job card. Removing it keeps it on the shortfall list."
						: "You can add it again from this supplier's parts."}
				</ConfirmDialog>
			)}
		</>
	);
}
