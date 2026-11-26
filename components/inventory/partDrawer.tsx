"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/common/buttons";
import { Drawer } from "@/components/common/drawer";
import { FormField } from "@/components/forms";
import type { FormFieldConfig } from "@/components/forms/types";
import {
	PART_CATEGORIES,
	PART_UNITS,
	costUpdatedLabel,
	qtyLabel,
	suggestSku,
	type Part,
	type PartCategory,
} from "@/lib/inventory";
import { uploadStorageFiles } from "@/lib/storageClient";
import type { SupplierCatalog } from "@/lib/suppliers";
import PartThumb from "./partThumb";

type Values = {
	photo: unknown;
	name: string;
	category: PartCategory;
	sku: string;
	unit: string;
	spec: string;
	cost: string;
	supplierId: string;
	inStock: string;
	reorderLevel: string;
	notes: string;
};

const wholeNumber = (label: string) => ({
	required: `${label} is required`,
	validate: (v: string) => /^\d{1,6}$/.test(String(v ?? "").trim()) || "Enter a whole number",
});

/** The first picked image in a file field's value, if any. */
function pickedPhoto(value: unknown): File | null {
	const list = Array.isArray(value) ? value : value ? [value] : [];
	return list.find((f): f is File => f instanceof File) ?? null;
}

/** Add a part, or edit one (its SKU is fixed once it's created). */
export default function PartDrawer({
	part,
	catalog,
	takenSkus,
	today,
	onSave,
	onArchive,
	onClose,
}: {
	/** The part being edited; leave out to add one. */
	part?: Part;
	catalog: SupplierCatalog;
	/** SKUs already in use, so a new one is unique. */
	takenSkus: Set<string>;
	today: string;
	onSave: (part: Part) => void | Promise<void>;
	onArchive?: () => void;
	onClose: () => void;
}) {
	const formId = useId();
	const [submitting, setSubmitting] = useState(false);
	const {
		control,
		register,
		getValues,
		setValue,
		setError,
		handleSubmit,
		formState: { errors },
	} = useForm<Values>({
		mode: "onTouched",
		defaultValues: {
			name: part?.name ?? "",
			category: part?.category ?? "Hardware",
			sku: part?.sku ?? "",
			unit: part?.unit ?? "piece",
			spec: part?.spec ?? "",
			cost: part ? String(part.unitCost) : "",
			supplierId: part?.supplierId ?? "",
			inStock: part ? String(part.inStock) : "0",
			reorderLevel: part ? String(part.reorderLevel) : "",
			notes: part?.notes ?? "",
		},
	});
	const [category, name, photo] = useWatch({ control, name: ["category", "name", "photo"] });
	const suggestedSku = suggestSku(category, name ?? "", takenSkus);
	const hasNewPhoto = !!pickedPhoto(photo);

	const units = part && !PART_UNITS.includes(part.unit) ? [part.unit, ...PART_UNITS] : PART_UNITS;

	const field = (config: FormFieldConfig) => (
		<FormField
			key={config.name}
			field={{ ...config, id: `${formId}-${config.name}` }}
			register={register}
			control={control}
			getValues={getValues}
			setValue={setValue}
			errors={errors}
			hideRequiredMark
		/>
	);

	const submit = async (v: Values) => {
		const sku = part?.sku ?? (v.sku.trim().toUpperCase() || suggestedSku);
		if (!part && takenSkus.has(sku)) {
			setError("sku", { message: `${sku} is already used by another part` });
			return;
		}
		const unitCost = Number(v.cost);
		const costChanged = !part || part.unitCost !== unitCost;
		const file = pickedPhoto(v.photo);
		setSubmitting(true);
		try {
			let photoUrl = part?.photoUrl;
			if (file) {
				const uploaded = await uploadStorageFiles("parts", [file]);
				if (!uploaded.ok) {
					toast.error(uploaded.message);
					return;
				}
				photoUrl = uploaded.urls[0];
			}
			await onSave({
				id: sku,
				sku,
				name: v.name.trim(),
				category: v.category,
				unit: v.unit,
				spec: v.spec.trim(),
				unitCost,
				costUpdatedOn: costChanged ? today : part.costUpdatedOn,
				costUpdatedBy: costChanged ? "you" : part.costUpdatedBy,
				inStock: Number(v.inStock),
				reserved: part?.reserved ?? 0,
				reorderLevel: Number(v.reorderLevel),
				supplierId: v.supplierId,
				notes: v.notes?.trim() ?? "",
				photoUrl,
			});
		} finally {
			setSubmitting(false);
		}
	};

	const photoField: FormFieldConfig = {
		name: "photo",
		type: "image",
		label: part ? "Replace photo (optional)" : "Photo",
		description: "JPG, PNG or HEIC, up to 10 MB",
		maxSizeMB: 10,
		showPreview: true,
		validation: part
			? undefined
			: {
					validate: (v: unknown) => !!pickedPhoto(v) || "Add a photo of the part",
				},
	};

	return (
		<Drawer
			title={part ? `Edit ${part.name}` : "Add a part"}
			description={
				part
					? `${part.sku} · last cost update ${part.costUpdatedOn === today ? "today" : costUpdatedLabel(part, today)} by ${part.costUpdatedBy}`
					: "It becomes available for furniture types and quotes once saved."
			}
			onClose={onClose}
			footer={
				<>
					{onArchive && (
						<Button variant="danger" size="sm" onClick={onArchive}>
							Archive part
						</Button>
					)}
					<span className="flex-1" />
					<Button onClick={onClose}>Cancel</Button>
					<Button
						type="submit"
						form={formId}
						variant="primary"
						disabled={submitting || (!part && !hasNewPhoto)}
					>
						{submitting ? "Saving…" : part ? "Save changes" : "Add part"}
					</Button>
				</>
			}
		>
			<form
				id={formId}
				noValidate
				className="flex flex-col gap-5"
				onSubmit={handleSubmit(submit)}
			>
				<div className="flex flex-col gap-2">
					{part && (
						<div className="flex items-center gap-4">
							<PartThumb part={part} size="lg" label={`Photo of ${part.name}`} />
							<p className="text-small text-fg-secondary">
								Shown on furniture types, job cards and purchase orders so everyone
								picks the right part.
							</p>
						</div>
					)}
					{field(photoField)}
					{!part && (
						<p className="text-small text-fg-secondary">
							Required. A clear photo on a plain background, ideally with a tape
							measure for scale. It shows wherever the part is picked or ordered.
						</p>
					)}
				</div>

				{field({
					name: "name",
					type: "text",
					label: "Part name",
					placeholder: "As procurement and production call it",
					validation: { required: "Part name is required" },
				})}

				<div className="grid gap-4 sm:grid-cols-2">
					{field({
						name: "category",
						type: "select",
						label: "Category",
						options: PART_CATEGORIES.map((c) => ({ label: c, value: c })),
					})}
					{part
						? field({
								name: "sku",
								type: "text",
								label: "SKU",
								disabled: true,
								description: "Set when the part is created.",
							})
						: field({
								name: "sku",
								type: "text",
								label: "SKU",
								placeholder: suggestedSku,
								description:
									"Leave blank to use the suggestion. Can't change later.",
								validation: {
									validate: (v: string) =>
										!v?.trim() ||
										/^[A-Za-z0-9-]{3,20}$/.test(v.trim()) ||
										"Letters, numbers and dashes only",
								},
							})}
					{field({
						name: "unit",
						type: "select",
						label: "Unit",
						options: units.map((u) => ({ label: u, value: u })),
					})}
					{field({
						name: "spec",
						type: "text",
						label: "Spec",
						placeholder: "Size, finish, grade",
					})}
				</div>

				<h3 className="text-h3">{part ? "Cost" : "Cost and supplier"}</h3>
				<div className="grid gap-4 sm:grid-cols-2">
					{field({
						name: "cost",
						type: "amount",
						label: "Unit cost",
						currencySymbol: "₦",
						placeholder: "₦0",
						description: part
							? "Used for new quotes only."
							: "Accounting is notified of new costs.",
						validation: {
							validate: (v: string) => Number(v) > 0 || "Enter a cost above ₦0",
						},
					})}
					<div className="flex flex-col gap-1">
						{field({
							name: "supplierId",
							type: "select",
							label: part ? "Supplier" : "Main supplier",
							placeholder: "Pick a supplier",
							options: catalog.suppliers.map((s) => ({
								label: s.business,
								value: s.id,
							})),
							validation: { required: "Pick a supplier" },
						})}
						<Link href="/suppliers" className="text-small">
							Not listed? Add a supplier
						</Link>
					</div>
				</div>

				<h3 className="text-h3">{part ? "Stock" : "Opening stock"}</h3>
				<div className="grid gap-4 sm:grid-cols-2">
					{field({
						name: "inStock",
						type: "text",
						label: part ? "In stock" : "In stock now",
						inputMode: "numeric",
						description: part
							? `${qtyLabel(part.reserved, part.unit)} reserved for confirmed orders.`
							: undefined,
						validation: {
							...wholeNumber("In stock"),
							validate: (v: string) =>
								!/^\d{1,6}$/.test(String(v ?? "").trim())
									? "Enter a whole number"
									: !part || Number(v) >= part.reserved
										? true
										: `Can't be less than the ${part.reserved} reserved`,
						},
					})}
					{field({
						name: "reorderLevel",
						type: "text",
						label: "Reorder level",
						placeholder: "e.g. 20",
						inputMode: "numeric",
						description: "Flagged Low when available stock falls below this.",
						validation: wholeNumber("Reorder level"),
					})}
				</div>

				{field({
					name: "notes",
					type: "textarea",
					label: "Notes (optional)",
					placeholder: "Storage, quality, substitutes…",
					rows: 3,
				})}

				{part && (
					<p className="rounded-md bg-subtle p-3 text-small text-fg-secondary">
						Cost changes are logged in Pricing &amp; margins history and Accounting is
						notified. Quotes already sent keep their prices.
					</p>
				)}
			</form>
		</Drawer>
	);
}
