/**
 * People's names: an optional title, then first name and surname. Every form
 * that takes a person's name asks for these parts, never one "full name".
 *
 * The database keeps the written-out name (profiles.full_name, clients.name,
 * staff_members.full_name, suppliers.contact) in step with the parts by
 * trigger, splitting on the last word the same way as splitName. The title is
 * kept out of it, so initials, search and sign-in don't change.
 */

export type PersonName = { firstName: string; surname: string };

/** Titles offered on every name, most common first. */
export const TITLES = [
	"Mr",
	"Mrs",
	"Ms",
	"Miss",
	"Dr",
	"Prof",
	"Chief",
	"Engr",
	"Arc",
	"Barr",
	"Pastor",
	"Rev",
	"Alhaji",
	"Alhaja",
	"Hon",
	"Sir",
	"Lady",
] as const;

export const isTitle = (v: string) => (TITLES as readonly string[]).includes(v);

/** "Adaeze" + "Okafor" → "Adaeze Okafor". */
export const joinName = ({ firstName, surname }: PersonName) =>
	[firstName.trim(), surname.trim()].filter(Boolean).join(" ");

/** "Mrs" + "Adaeze Okafor" → "Mrs Adaeze Okafor", e.g. for a letter or document. */
export const withTitle = (name: string, title = "") =>
	[title.trim(), name.trim()].filter(Boolean).join(" ");

/** "Mary Jane Okafor" → { firstName: "Mary Jane", surname: "Okafor" }; one word is a first name. */
export function splitName(full: string): PersonName {
	const words = full.trim().split(/\s+/).filter(Boolean);
	if (words.length < 2) return { firstName: words[0] ?? "", surname: "" };
	return { firstName: words.slice(0, -1).join(" "), surname: words[words.length - 1] };
}
