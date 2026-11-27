"use client";

import { useId } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/common/buttons";
import { FormField } from "@/components/forms";
import {
	addressFieldConfigs,
	addressFromValues,
	addressValues,
	useAddressCountry,
} from "@/components/forms/addressFields";
import type { FormFieldConfig } from "@/components/forms/types";
import type { PostalAddress } from "@/lib/address";
import type { CompanyAddress } from "@/lib/companySettings";

type Values = Record<string, string>;

const PREFIX = "address";

/** One company address: a name, then the country-aware address fields. */
export default function AddressForm({
	initial,
	takenNames,
	saving,
	onSave,
	onCancel,
}: {
	initial?: CompanyAddress;
	/** Other addresses' names, so two can't share one. */
	takenNames: string[];
	saving: boolean;
	onSave: (values: PostalAddress & { name: string }) => void;
	onCancel: () => void;
}) {
	const formId = useId();
	const form = useForm<Values>({
		mode: "onTouched",
		defaultValues: { name: initial?.name ?? "", ...addressValues(PREFIX, initial) },
	});
	const { control, register, getValues, setValue, handleSubmit, formState } = form;
	const country = useAddressCountry(control, PREFIX);

	const field = (config: FormFieldConfig) => (
		<FormField<Values>
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

	return (
		<form
			noValidate
			onSubmit={handleSubmit((v) =>
				onSave({ ...addressFromValues(PREFIX, v), name: v.name.trim() }),
			)}
			className="flex flex-col gap-4"
		>
			{field({
				name: "name",
				type: "text",
				label: "Name",
				placeholder: "e.g. Workshop",
				autoFocus: true,
				validation: {
					validate: (v: string) => {
						const name = String(v ?? "").trim();
						if (!name) return "Give it a name";
						return (
							!takenNames.some((t) => t.toLowerCase() === name.toLowerCase()) ||
							"Another address has this name"
						);
					},
				},
			})}
			{addressFieldConfigs({
				prefix: PREFIX,
				country,
				form,
				title: "Street address",
			}).map(field)}
			<div className="flex flex-wrap justify-end gap-3">
				<Button onClick={onCancel}>Cancel</Button>
				<Button type="submit" variant="primary" disabled={saving}>
					{initial ? "Save address" : "Add address"}
				</Button>
			</div>
		</form>
	);
}
