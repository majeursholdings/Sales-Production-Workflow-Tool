"use client";

import { useId, useState } from "react";
import { Search } from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Button } from "@/components/common/buttons";
import { Drawer } from "@/components/common/drawer";
import { FormField } from "@/components/forms";
import { controlClass } from "@/components/forms/input";
import type { FormFieldConfig } from "@/components/forms/types";
import { cn } from "@/lib/cn";
import { wholeNaira } from "@/lib/quoteBuilder";
import {
	materialOf,
	offersFor,
	plural,
	type Supplier,
	type SupplierCatalog,
	type SupplierMaterial,
} from "@/lib/suppliers";
import MaterialThumb from "./materialThumb";

type Values = { sku: string; price: string; leadDays: string; minOrder: string };

/** A new material for a supplier: what they charge and their terms. It's rated after the first delivery. */
export type NewMaterial = Pick<SupplierMaterial, "sku" | "price" | "leadDays" | "minOrder">;

/** Add a material this supplier sells us, picked from inventory. Other suppliers of it stay as they are. */
export default function AddMaterialDrawer({
	catalog,
	supplier,
	onSave,
	onClose,
}: {
	catalog: SupplierCatalog;
	supplier: Supplier;
	onSave: (material: NewMaterial) => void;
	onClose: () => void;
}) {
	const formId = useId();
	const [query, setQuery] = useState("");
	const methods = useForm<Values>({ mode: "onTouched", defaultValues: { sku: "" } });
	const {
		control,
		register,
		getValues,
		setValue,
		handleSubmit,
		formState: { errors },
	} = methods;
	const sku = useWatch({ control, name: "sku" });

	const mine = new Set(supplier.materials.map((m) => m.sku));
	const q = query.trim().toLowerCase();
	const options = catalog.materials.filter((m) => !mine.has(m.sku)).filter(
		(m) => !q || m.name.toLowerCase().includes(q) || m.sku.toLowerCase().includes(q),
	);

	const unit = sku ? materialOf(catalog, sku).unit : "unit";
	const others = sku ? offersFor(catalog, sku) : [];
	const pricePlaceholder = others.length
		? (() => {
				const lo = Math.min(...others.map((o) => o.price));
				const hi = Math.max(...others.map((o) => o.price));
				return `Others charge ${lo === hi ? wholeNaira(lo) : `${wholeNaira(lo)}–${wholeNaira(hi)}`}`;
			})()
		: "e.g. ₦18,500";

	const fields: FormFieldConfig[] = [
		{
			name: "price",
			type: "amount",
			label: "Their price",
			placeholder: pricePlaceholder,
			description: `Per ${unit}`,
			validation: { validate: (v: string) => Number(v) > 0 || "Enter a price above ₦0" },
		},
		{
			name: "leadDays",
			type: "text",
			label: "Lead time",
			placeholder: "e.g. 5",
			description: "Working days",
			inputMode: "numeric",
			validation: {
				validate: (v: string) => /^\d{1,3}$/.test(v?.trim() ?? "") || "Enter whole days",
			},
		},
		{
			name: "minOrder",
			type: "text",
			label: "Minimum order",
			placeholder: `e.g. 10 ${unit}s`,
		},
	];

	return (
		<Drawer
			title={`Add a material ${supplier.business} supplies`}
			description="Pick it from inventory. Other suppliers of the same material stay as they are."
			onClose={onClose}
			footer={
				<>
					<span className="flex-1" />
					<Button onClick={onClose}>Cancel</Button>
					<Button type="submit" form={formId} variant="primary" disabled={!sku}>
						Add material
					</Button>
				</>
			}
		>
			<form
				id={formId}
				noValidate
				className="flex flex-col gap-5"
				onSubmit={handleSubmit((v) =>
					onSave({
						sku: v.sku,
						price: Number(v.price),
						leadDays: Number(v.leadDays),
						minOrder: v.minOrder?.trim() || "—",
					}),
				)}
			>
				<label className="relative flex items-center">
					<span className="sr-only">Search inventory</span>
					<Search
						aria-hidden="true"
						className="pointer-events-none absolute left-3 size-4 text-fg-tertiary"
					/>
					<input
						type="search"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Search parts or SKU"
						className={cn(controlClass, "h-10 pl-9")}
					/>
				</label>

				<Controller
					name="sku"
					control={control}
					rules={{ required: "Pick a material" }}
					render={({ field: ctrl }) => (
						<div
							role="group"
							aria-label="Materials in inventory"
							className="flex flex-col gap-2"
						>
							{options.length === 0 && (
								<p className="text-small text-fg-tertiary">
									{q
										? "No material matches. Try a different name or SKU."
										: `${supplier.business} already supplies every material in inventory.`}
								</p>
							)}
							{options.map((m) => {
								const count = offersFor(catalog, m.sku).length;
								return (
									<button
										key={m.sku}
										type="button"
										aria-pressed={ctrl.value === m.sku}
										onClick={() => ctrl.onChange(m.sku)}
										className={cn(
											"flex cursor-pointer items-center gap-3 rounded-md border border-line bg-surface p-3 text-start hover:bg-subtle",
											"focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
											"aria-pressed:border-accent aria-pressed:bg-accent-subtle",
										)}
									>
										<MaterialThumb sku={m.sku} />
										<span className="flex min-w-0 flex-1 flex-col">
											<strong className="text-fg">{m.name}</strong>
											<span className="text-small text-fg-secondary">
												{m.sku} ·{" "}
												{count
													? `${plural(count, "supplier")} now`
													: "No supplier yet"}
											</span>
										</span>
									</button>
								);
							})}
						</div>
					)}
				/>

				<div className="grid gap-4 sm:grid-cols-3">
					{fields.map((f) => (
						<FormField
							key={f.name}
							field={{ ...f, id: `${formId}-${f.name}` }}
							register={register}
							control={control}
							getValues={getValues}
							setValue={setValue}
							errors={errors}
							hideRequiredMark
						/>
					))}
				</div>

				<p className="rounded-md bg-subtle p-3 text-small text-fg-secondary">
					Rate quality, reliability and availability after the first delivery. Until then
					it shows as “Not rated yet” and isn&apos;t suggested ahead of rated suppliers.
				</p>
			</form>
		</Drawer>
	);
}
