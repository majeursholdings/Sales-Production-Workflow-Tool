"use client";

import { useId } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Button, LinkButton } from "@/components/common/buttons";
import { Drawer } from "@/components/common/drawer";
import { FormField } from "@/components/forms";
import type { FormFieldConfig } from "@/components/forms/types";
import { DataTable, type ColumnDef } from "@/components/tables";
import { PO_APPROVAL_LIMIT, costLabel, type OrderGroup, type OrderLine } from "@/lib/inventory";
import { plural } from "@/lib/suppliers";
import PartThumb from "./partThumb";

type Values = Record<string, string | boolean>;

const money = (n: number) =>
	`₦${n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const onKey = (supplierId: string) => `on:${supplierId}`;
const qtyKey = (sku: string) => `qty:${sku}`;
const wholeNumber = (v: unknown) => {
	const n = Number(v);
	return Number.isInteger(n) && n > 0 ? n : 0;
};

/** Suggested draft orders, one per supplier: untick a supplier or change quantities, then create the drafts. */
export default function RaiseOrdersDrawer({
	groups,
	onCreate,
	onClose,
}: {
	groups: OrderGroup[];
	/** The ticked groups with the quantities as set. */
	onCreate: (groups: OrderGroup[]) => void;
	onClose: () => void;
}) {
	const formId = useId();
	const form = useForm<Values>({
		mode: "onTouched",
		defaultValues: Object.fromEntries([
			...groups.map((g) => [onKey(g.supplierId), true]),
			...groups.flatMap((g) => g.lines.map((l) => [qtyKey(l.sku), String(l.qty)])),
		]),
	});
	const { control, register, getValues, setValue, handleSubmit, formState } = form;
	const values = useWatch({ control }) as Values;

	const qtyOf = (sku: string) => wholeNumber(values[qtyKey(sku)]);
	const totalOf = (g: OrderGroup) => g.lines.reduce((sum, l) => sum + qtyOf(l.sku) * l.price, 0);
	const picked = groups
		.filter((g) => values[onKey(g.supplierId)])
		.map((g) => ({
			...g,
			lines: g.lines.map((l) => ({ ...l, qty: qtyOf(l.sku) })).filter((l) => l.qty > 0),
		}))
		.filter((g) => g.lines.length > 0);
	const overLimit = picked.filter((g) => totalOf(g) > PO_APPROVAL_LIMIT);

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

	const columns = (g: OrderGroup, on: boolean): ColumnDef<OrderLine & { id: string }>[] => [
		{
			key: "part",
			header: "Part",
			cell: (l) => (
				<span className="flex min-w-48 items-center gap-3">
					<PartThumb part={l} />
					<span className="flex min-w-0 flex-col">
						<strong className="text-fg">{l.name}</strong>
						<span className="text-small text-fg-secondary">{l.why}</span>
					</span>
				</span>
			),
		},
		{
			key: "qty",
			header: "Order",
			className: "w-40",
			cell: (l) => (
				<span className="flex items-start gap-2">
					<span className="w-20">
						{field({
							name: qtyKey(l.sku),
							type: "text",
							label: `${l.name} quantity`,
							hideLabel: true,
							inputMode: "numeric",
							disabled: !on,
							className: "[&_input]:text-end",
							validation: {
								validate: (v: string, all: Values) =>
									!all[onKey(g.supplierId)] ||
									wholeNumber(v) > 0 ||
									"Enter a quantity",
							},
						})}
					</span>
					<span className="pt-2.5 text-small text-fg-secondary">
						{qtyOf(l.sku) === 1 ? l.unit : `${l.unit}s`}
					</span>
				</span>
			),
		},
		{
			key: "line",
			header: "Line",
			className: "text-end",
			cell: (l) => (
				<span className="flex flex-col items-end">
					<strong className="whitespace-nowrap text-fg tabular">
						{money(qtyOf(l.sku) * l.price)}
					</strong>
					<span className="text-small whitespace-nowrap text-fg-tertiary">
						at {costLabel(l.price)}
					</span>
				</span>
			),
		},
	];

	return (
		<Drawer
			title="Raise purchase orders"
			description="Parts short for job cards or at their reorder level, grouped by supplier. One draft order per supplier."
			onClose={onClose}
			footer={
				<>
					<LinkButton variant="ghost" size="sm" href="/purchase-orders/new">
						Start a blank order instead
					</LinkButton>
					<span className="flex-1" />
					<Button onClick={onClose}>Cancel</Button>
					<Button
						type="submit"
						form={formId}
						variant="primary"
						disabled={picked.length === 0}
					>
						{picked.length === 0
							? "Create draft orders"
							: `Create ${plural(picked.length, "draft order")}`}
					</Button>
				</>
			}
		>
			<form
				id={formId}
				noValidate
				className="flex flex-col gap-4"
				onSubmit={handleSubmit(() => onCreate(picked))}
			>
				{groups.length === 0 && (
					<p className="text-body text-fg-secondary">
						Nothing to order: no part is short for a job card or at its reorder level.
					</p>
				)}

				{groups.map((g) => {
					const on = !!values[onKey(g.supplierId)];
					return (
						<DataTable
							key={g.supplierId}
							tableId={`raise-${g.supplierId}`}
							compact
							columns={columns(g, on)}
							rows={g.lines.map((l) => ({ ...l, id: l.sku }))}
							rowClassName={() => (on ? undefined : "opacity-60")}
							toolbar={
								<div className="flex items-center gap-3 border-b border-line bg-subtle px-4 py-3">
									<div className="min-w-0 flex-1">
										{field({
											name: onKey(g.supplierId),
											type: "checkbox",
											label: (
												<span className="flex flex-col">
													<strong className="text-fg">
														{g.supplier}
													</strong>
													<span className="text-small text-fg-secondary">
														{g.meta}
													</span>
												</span>
											),
										})}
									</div>
									<strong className="text-fg tabular">{money(totalOf(g))}</strong>
								</div>
							}
						/>
					);
				})}

				<p className="text-small text-fg-secondary">
					Quantities include the reorder level. Change them here or on each draft before
					sending. Orders over {costLabel(PO_APPROVAL_LIMIT)} need MD or GM approval.
				</p>
				{overLimit.length > 0 && (
					<p
						role="status"
						className="rounded-md border border-warning-line bg-warning-subtle p-3 text-small text-fg"
					>
						{overLimit.map((g) => g.supplier).join(" and ")}{" "}
						{overLimit.length === 1 ? "is" : "are"} over {costLabel(PO_APPROVAL_LIMIT)}{" "}
						and will go to MD or GM for approval.
					</p>
				)}
			</form>
		</Drawer>
	);
}
