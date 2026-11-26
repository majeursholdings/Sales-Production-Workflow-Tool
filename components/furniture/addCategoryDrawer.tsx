"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { addFurnitureCategoryAction } from "@/app/(dashboard)/furniture-types/actions";
import { Button } from "@/components/common/buttons";
import { Drawer } from "@/components/common/drawer";
import MainForm from "@/components/forms";
import type { FormFieldConfig } from "@/components/forms/types";
import type { FurnitureCategory } from "@/lib/furnitureTypes";

type Values = { name: string; markup: string; ceiling: string };

const percentRule = {
	validate: (value: string) =>
		(value.trim() !== "" && Number(value) >= 0 && Number(value) <= 100) ||
		"Enter a percentage from 0 to 100.",
};

const fields: FormFieldConfig[] = [
	{
		name: "name",
		type: "text",
		label: "Category name",
		placeholder: "e.g. Sofas",
		validation: { required: "Give the category a name." },
	},
	{
		name: "markup",
		type: "number",
		label: "Default markup (%)",
		description: "Added on top of the standard cost of every piece in this category.",
		min: 0,
		max: 100,
		validation: percentRule,
	},
	{
		name: "ceiling",
		type: "number",
		label: "Markup ceiling (%)",
		description: "The most customer care can raise the markup to on a quote.",
		min: 0,
		max: 100,
		validation: percentRule,
	},
];

/** Add a markup category (as in Pricing & margins) while creating a furniture type. */
export default function AddCategoryDrawer({
	onAdded,
	onClose,
}: {
	onAdded: (category: FurnitureCategory) => void;
	onClose: () => void;
}) {
	const [saving, startSaving] = useTransition();
	const methods = useForm<Values>({
		mode: "onTouched",
		defaultValues: { name: "", markup: "30", ceiling: "35" },
	});

	const submit = (v: Values) =>
		startSaving(async () => {
			const result = await addFurnitureCategoryAction({
				name: v.name,
				markup: Number(v.markup),
				ceiling: Number(v.ceiling),
			});
			if (!result.ok) {
				toast.error(result.message);
				return;
			}
			toast.success(`${result.data.name} added to Pricing & margins.`);
			onAdded(result.data);
		});

	return (
		<Drawer
			title="New category"
			description="Categories set the markup and ceiling for their furniture types. You can change them later in Pricing & margins."
			onClose={onClose}
		>
			<MainForm<Values>
				methods={methods}
				fields={fields}
				hideRequiredMarks
				requireValidToSubmit={false}
				onSubmit={submit}
				renderFooter={() => (
					<div className="flex flex-wrap justify-end gap-3">
						<Button onClick={onClose}>Cancel</Button>
						<Button type="submit" variant="primary" disabled={saving}>
							{saving ? "Adding…" : "Add category"}
						</Button>
					</div>
				)}
			/>
		</Drawer>
	);
}
