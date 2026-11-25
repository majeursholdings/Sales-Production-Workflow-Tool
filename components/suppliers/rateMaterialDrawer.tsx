"use client";

import { useId } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Button } from "@/components/common/buttons";
import { Drawer } from "@/components/common/drawer";
import { FormField } from "@/components/forms";
import type { FormFieldConfig } from "@/components/forms/types";
import {
	RATING_CRITERIA,
	compareOffer,
	formatScore,
	materialOf,
	offersFor,
	preferredSupplierId,
	scoreOf,
	type Ratings,
	type Supplier,
	type SupplierCatalog,
	type SupplierMaterial,
} from "@/lib/suppliers";
import { lastRatedNote } from "./materialViewDrawer";
import MaterialThumb from "./materialThumb";
import RatingPicker from "./ratingPicker";

type Values = Ratings & {
	price: string;
	leadDays: string;
	minOrder: string;
	preferred: boolean;
	note: string;
};

/** What saving a rating changes on the supplier's material, and whether they're now preferred for it. */
export type RatingDraft = Pick<
	SupplierMaterial,
	"price" | "leadDays" | "minOrder" | "ratingNote"
> & {
	ratings: Ratings;
	preferred: boolean;
};

/** Procurement rates one supplier for one material, and updates their price and terms at the same time. */
export default function RateMaterialDrawer({
	catalog,
	supplier,
	link,
	onSave,
	onClose,
}: {
	catalog: SupplierCatalog;
	supplier: Supplier;
	link: SupplierMaterial;
	onSave: (draft: RatingDraft) => void;
	onClose: () => void;
}) {
	const formId = useId();
	const material = materialOf(catalog, link.sku);
	const name = material.name.toLowerCase();
	const cmp = compareOffer(catalog, supplier.id, link.sku);

	const methods = useForm<Values>({
		mode: "onTouched",
		defaultValues: {
			quality: link.ratings?.quality ?? 0,
			reliability: link.ratings?.reliability ?? 0,
			availability: link.ratings?.availability ?? 0,
		},
	});
	const {
		control,
		register,
		getValues,
		setValue,
		handleSubmit,
		formState: { errors },
	} = methods;

	const [quality, reliability, availability] = useWatch({
		control,
		name: ["quality", "reliability", "availability"],
	});
	const allRated = quality > 0 && reliability > 0 && availability > 0;
	const score = allRated ? scoreOf({ quality, reliability, availability }) : null;

	// Where this score would put them among the other rated suppliers of the material
	const others = offersFor(catalog, link.sku).filter(
		(o) => o.supplier.id !== supplier.id && o.score !== null,
	);
	const rank = score === null ? 0 : others.filter((o) => (o.score ?? 0) > score).length + 1;
	const rankNote =
		cmp.count > 1
			? `${rank ? `Ranks ${rank} of ${others.length + 1} suppliers of ${name} on score. ` : ""}Price and lead time are compared separately.`
			: `The only supplier of ${name} so far.`;

	const fields: FormFieldConfig[] = [
		{
			name: "price",
			type: "amount",
			label: "Their price",
			description: `Per ${material.unit}`,
			defaultValue: String(link.price),
			validation: { validate: (v: string) => Number(v) > 0 || "Enter a price above ₦0" },
		},
		{
			name: "leadDays",
			type: "text",
			label: "Lead time",
			description: "Working days",
			inputMode: "numeric",
			defaultValue: String(link.leadDays),
			validation: {
				validate: (v: string) => /^\d{1,3}$/.test(v?.trim() ?? "") || "Enter whole days",
			},
		},
		{
			name: "minOrder",
			type: "text",
			label: "Minimum order",
			defaultValue: link.minOrder,
		},
	];
	const preferredField: FormFieldConfig = {
		name: "preferred",
		type: "checkbox",
		label: `Preferred supplier for ${name}`,
		defaultValue: preferredSupplierId(catalog, link.sku) === supplier.id,
		disabled: cmp.count === 1,
	};
	const noteField: FormFieldConfig = {
		name: "note",
		type: "textarea",
		label: "What happened on the last delivery (optional)",
		placeholder: "e.g. Two pieces had knots; replaced the next day.",
		description: "Kept with the rating so others see why it changed.",
		defaultValue: link.ratingNote,
		rows: 3,
	};
	const field = (f: FormFieldConfig) => (
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
	);

	return (
		<Drawer
			title={`Rate ${name} from ${supplier.business}`}
			description={lastRatedNote(link)}
			onClose={onClose}
			footer={
				<>
					<span className="flex-1" />
					<Button onClick={onClose}>Cancel</Button>
					<Button type="submit" form={formId} variant="primary">
						Save rating
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
						price: Number(v.price),
						leadDays: Number(v.leadDays),
						minOrder: v.minOrder.trim() || "—",
						ratingNote: v.note?.trim() ?? "",
						ratings: {
							quality: v.quality,
							reliability: v.reliability,
							availability: v.availability,
						},
						preferred: !!v.preferred,
					}),
				)}
			>
				<div className="flex items-center gap-3 rounded-md border border-line p-3">
					<MaterialThumb sku={link.sku} />
					<span className="flex min-w-0 flex-col">
						<strong className="text-fg">{material.name}</strong>
						<span className="text-small text-fg-secondary">
							{link.sku} · {cmp.othersNote}
						</span>
					</span>
				</div>

				<div className="grid gap-4 sm:grid-cols-3">{fields.map(field)}</div>

				<div className="flex flex-col">
					{RATING_CRITERIA.map((c) => (
						<Controller
							key={c.key}
							name={c.key}
							control={control}
							rules={{
								validate: (v: number) => v > 0 || `Rate ${c.label.toLowerCase()}`,
							}}
							render={({ field: ctrl, fieldState }) => (
								<RatingPicker
									label={c.label}
									hint={c.hint}
									value={ctrl.value}
									onChange={ctrl.onChange}
									error={fieldState.error?.message}
								/>
							)}
						/>
					))}
				</div>

				<div className="flex flex-col gap-1 rounded-md bg-accent-subtle p-3">
					<div className="flex justify-between gap-3 font-bold text-accent-fg">
						<span>Score for {name}</span>
						<span className="tabular" aria-live="polite">
							{formatScore(score)} / 5
						</span>
					</div>
					<span className="text-small text-fg-secondary">{rankNote}</span>
				</div>

				{field(preferredField)}
				{field(noteField)}
			</form>
		</Drawer>
	);
}
