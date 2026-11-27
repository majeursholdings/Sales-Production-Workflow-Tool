"use client";

import { useWatch, type Control, type FieldValues, type UseFormReturn } from "react-hook-form";
import {
	COUNTRIES,
	EMPTY_ADDRESS,
	addressErrors,
	addressFields,
	isBlankAddress,
	type AddressPart,
	type PostalAddress,
} from "@/lib/address";
import type { FormFieldConfig } from "./types";

/**
 * Country-aware address fields for any form (MainForm or hand-placed
 * FormFields). The parts sit under flat keys like "address:city", because
 * FormField looks errors up by the field's name.
 *
 *   const country = useAddressCountry(methods.control, "address");
 *   fields: [...addressFieldConfigs({ prefix: "address", country, form: methods, title: "Delivery address" })]
 *   defaultValues: addressValues("address", client.addressParts)
 *   onSubmit: addressFromValues("address", values)
 */

const KEYS = Object.keys(EMPTY_ADDRESS) as (keyof PostalAddress)[];

export const addressKey = (prefix: string, part: keyof PostalAddress) => `${prefix}:${part}`;

const PLACEHOLDERS: Partial<Record<AddressPart, string>> = {
	street: "e.g. 32 QMB Builders Mart Road",
	landmark: "e.g. Opposite Elf Bus Stop",
};

/**
 * Starting values for the fields. An old free-text address (from before
 * addresses were split up) goes into the street, to be split by hand.
 */
export function addressValues(
	prefix: string,
	address?: PostalAddress | null,
	legacyText = "",
): Record<string, string> {
	const a = address ?? { ...EMPTY_ADDRESS, street: legacyText };
	return Object.fromEntries(KEYS.map((k) => [addressKey(prefix, k), a[k] ?? ""]));
}

/** The address entered, read back from the form's values. */
export function addressFromValues(prefix: string, values: Record<string, unknown>): PostalAddress {
	const out = { ...EMPTY_ADDRESS };
	for (const k of KEYS) out[k] = String(values[addressKey(prefix, k)] ?? "").trim();
	out.country = out.country || EMPTY_ADDRESS.country;
	return out;
}

/** The country picked so far, so the fields re-draw for it. */
export function useAddressCountry<T extends FieldValues>(control: Control<T>, prefix: string) {
	const country = useWatch({
		control: control as Control<FieldValues>,
		name: addressKey(prefix, "country"),
	});
	return String(country || EMPTY_ADDRESS.country);
}

/**
 * The country picker, then the parts that country uses in the order it writes
 * them, labelled its way (State, County, Post town, Eircode…), then a landmark.
 */
export function addressFieldConfigs<T extends FieldValues>({
	prefix,
	country,
	form,
	title = "Address",
	optional = false,
	description,
}: {
	prefix: string;
	country: string;
	form: Pick<UseFormReturn<T>, "getValues" | "setValue">;
	/** Label for the street line, e.g. "Delivery address". */
	title?: string;
	/** Leaving every part blank is fine; once anything is filled in, the country's rules apply. */
	optional?: boolean;
	/** Help under the street line. */
	description?: string;
}): FormFieldConfig[] {
	const { getValues, setValue } = form as unknown as Pick<
		UseFormReturn<FieldValues>,
		"getValues" | "setValue"
	>;
	const current = () => addressFromValues(prefix, getValues());

	const check = (key: AddressPart) => () => {
		const a = { ...current(), country };
		if (optional && isBlankAddress(a)) return true;
		return addressErrors(a)[key] ?? true;
	};

	const pickCountry = (next: string) => {
		// A state from the old country's list means nothing in the new one.
		const options = addressFields(next).find((f) => f.key === "state")?.options;
		const stateKey = addressKey(prefix, "state");
		if (options && !options.includes(String(getValues(stateKey) ?? ""))) {
			setValue(stateKey, "");
		}
	};

	return [
		{
			name: addressKey(prefix, "country"),
			type: "combobox",
			label: "Country",
			placeholder: "Search countries",
			options: COUNTRIES,
			onValueChange: pickCountry,
			validation: { required: "Pick a country" },
		},
		...addressFields(country).map((f): FormFieldConfig => ({
			name: addressKey(prefix, f.key),
			type: f.options ? "combobox" : f.key === "street" ? "textarea" : "text",
			rows: f.key === "street" ? 2 : undefined,
			label:
				f.key === "street"
					? optional
						? `${title} (optional)`
						: title
					: f.required || f.key === "landmark"
						? f.label
						: `${f.label} (optional)`,
			placeholder: f.example ? `e.g. ${f.example}` : PLACEHOLDERS[f.key],
			options: f.options?.map((o) => ({ label: o, value: o })),
			description:
				f.key === "street"
					? (description ?? "House number and street.")
					: f.key === "landmark"
						? "Optional. Helps drivers find it."
						: undefined,
			validation: { validate: check(f.key) },
		})),
	];
}

/** Side-by-side pairs for MainForm's rowPairs: the short parts, two to a row, in the country's order. */
export function addressRowPairs(prefix: string, country: string): [string, string][] {
	const short = addressFields(country)
		.map((f) => f.key)
		.filter((k) => k !== "street" && k !== "landmark")
		.map((k) => addressKey(prefix, k));
	const pairs: [string, string][] = [];
	for (let i = 0; i + 1 < short.length; i += 2) pairs.push([short[i], short[i + 1]]);
	return pairs;
}
