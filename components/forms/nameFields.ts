import { TITLES } from "@/lib/names";
import { validators } from "./form.validators";
import type { FormFieldConfig } from "./types";

/**
 * A person's name as title, first name and surname, on one row: spread the
 * fields into a form and add nameRow() to its rowPairs. Never ask for one
 * "full name" field.
 *
 * Values are `title`, `firstName`, `surname`; with a prefix, e.g. "contact",
 * they're `contactTitle`, `contactFirstName`, `contactSurname`.
 */
export function nameKeys(prefix = "") {
	const key = (k: string) => (prefix ? `${prefix}${k[0].toUpperCase()}${k.slice(1)}` : k);
	return { title: key("title"), firstName: key("firstName"), surname: key("surname") };
}

/** The row for MainForm's rowPairs. */
export const nameRow = (prefix = ""): [string, string, string] => {
	const k = nameKeys(prefix);
	return [k.title, k.firstName, k.surname];
};

export function nameFieldConfigs({
	prefix = "",
	defaults,
	description,
	disabled,
	who,
}: {
	prefix?: string;
	defaults?: { title?: string; firstName?: string; surname?: string };
	/** Help under the first name, e.g. "As it should appear on quotes." */
	description?: string;
	disabled?: boolean;
	/** Whose name, for labels like "Contact's first name". Plain "First name" when left out. */
	who?: string;
} = {}): FormFieldConfig[] {
	const k = nameKeys(prefix);
	const label = (part: string) => (who ? `${who}'s ${part.toLowerCase()}` : part);
	return [
		{
			name: k.title,
			type: "select",
			label: "Title",
			placeholder: "None",
			clearable: true,
			className: "md:w-32 md:flex-none",
			options: TITLES.map((t) => ({ label: t, value: t })),
			defaultValue: defaults?.title ?? "",
			disabled,
		},
		{
			name: k.firstName,
			type: "text",
			label: label("First name"),
			autoComplete: "given-name",
			defaultValue: defaults?.firstName,
			description,
			disabled,
			validation: validators.required(label("First name")),
		},
		{
			name: k.surname,
			type: "text",
			label: label("Surname"),
			autoComplete: "family-name",
			defaultValue: defaults?.surname,
			disabled,
			validation: validators.required(label("Surname")),
		},
	];
}
