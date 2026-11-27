/**
 * Country-aware postal addresses, from Google's open address metadata
 * (libaddressinput, the data behind Chrome and Android autofill). The data is
 * bundled in formats.json; refresh it with `npm run address:formats`.
 */
import rawFormats from "./formats.json";

// ─── Types ───────────────────────────────────────────────────────────────────

/** One address, broken into the parts countries use. Unused parts stay empty. */
export type PostalAddress = {
	/** ISO 3166-1 alpha-2, e.g. "NG". */
	country: string;
	/** House number and street, one or two lines. */
	street: string;
	/** Suburb, neighbourhood, district or townland, where the country uses one. */
	area: string;
	/** City, town or post town. */
	city: string;
	/** State, county, province, region… */
	state: string;
	postalCode: string;
	/** CEDEX and similar, in the few countries that use one. */
	sortingCode: string;
	/** Not part of the postal format: how to find it, e.g. "Opposite Elf Bus Stop". */
	landmark: string;
};

export type AddressPart = Exclude<keyof PostalAddress, "country">;

/** A part of the address as one country's form shows it. */
export type AddressField = {
	key: AddressPart;
	label: string;
	required: boolean;
	/** The country's states/counties/provinces, when it has a fixed list. */
	options?: string[];
	/** For the postal code, e.g. "100001". */
	example?: string;
};

type Format = {
	fmt?: string;
	req?: string;
	zip?: string;
	zipex?: string;
	zipName?: string;
	stateName?: string;
	cityName?: string;
	areaName?: string;
	states?: string[];
};

/**
 * Where we differ from Google's data. Royal Mail no longer needs a county, so
 * Google leaves it out, but people still write one: it's offered, not required.
 */
const OVERRIDES: Record<string, Format> = {
	GB: { fmt: "%N%n%O%n%A%n%C%n%S%n%Z", stateName: "county" },
};

const FORMATS = Object.fromEntries(
	Object.entries(rawFormats as Record<string, Format>).map(([c, f]) => [
		c,
		{ ...f, ...OVERRIDES[c] },
	]),
);
/** Defaults every country inherits (libaddressinput's "ZZ"). */
const BASE = FORMATS.ZZ;

export const DEFAULT_COUNTRY = "NG";

export const EMPTY_ADDRESS: PostalAddress = {
	country: DEFAULT_COUNTRY,
	street: "",
	area: "",
	city: "",
	state: "",
	postalCode: "",
	sortingCode: "",
	landmark: "",
};

// ─── Countries ───────────────────────────────────────────────────────────────

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

/** "Nigeria" from "NG"; the code itself when the browser doesn't know it. */
export const countryName = (code: string) => {
	try {
		return regionNames.of(code) ?? code;
	} catch {
		return code;
	}
};

/** Every country, by name, for a picker. */
export const COUNTRIES: { value: string; label: string }[] = Object.keys(FORMATS)
	.filter((c) => c !== "ZZ")
	.map((c) => ({ value: c, label: countryName(c) }))
	.sort((a, b) => a.label.localeCompare(b.label));

export const isCountry = (code: string) => code !== "ZZ" && code in FORMATS;

// ─── Fields per country ──────────────────────────────────────────────────────

const LABELS: Record<string, string> = {
	// state_name_type
	area: "Area",
	county: "County",
	department: "Department",
	district: "District",
	do_si: "Province",
	emirate: "Emirate",
	island: "Island",
	oblast: "Oblast",
	parish: "Parish",
	prefecture: "Prefecture",
	province: "Province",
	state: "State",
	// locality_name_type
	city: "City",
	post_town: "Post town",
	suburb: "Suburb",
	// sublocality_name_type
	neighborhood: "Neighbourhood",
	townland: "Townland",
	village_township: "Village or township",
	// zip_name_type
	eircode: "Eircode",
	pin: "PIN code",
	postal: "Postal code",
	zip: "ZIP code",
};

const label = (type: string | undefined, fallback: string) => (type && LABELS[type]) ?? fallback;

/** Format letters → our parts. N (name), O (organisation) and the rest aren't asked for. */
const PART_OF: Record<string, AddressPart> = {
	A: "street",
	D: "area",
	C: "city",
	S: "state",
	Z: "postalCode",
	X: "sortingCode",
};

const formatOf = (country: string): Format => ({ ...BASE, ...FORMATS[country] });

/** The parts a country's addresses have, in the order they're written there, then the landmark. */
export function addressFields(country: string): AddressField[] {
	const f = formatOf(country);
	const required = f.req ?? BASE.req ?? "";
	const letters = [...(f.fmt ?? BASE.fmt ?? "").matchAll(/%([A-Z])/g)].map((m) => m[1]);
	const seen = new Set<AddressPart>();
	const fields: AddressField[] = [];
	for (const letter of letters) {
		const key = PART_OF[letter];
		if (!key || seen.has(key)) continue;
		seen.add(key);
		const field: AddressField = {
			key,
			required: required.includes(letter),
			label: {
				street: "Street address",
				area: label(f.areaName, "Suburb"),
				city: label(f.cityName, "City"),
				state: label(f.stateName, "Province"),
				postalCode: label(f.zipName, "Postal code"),
				sortingCode: "Sorting code",
				landmark: "Landmark",
			}[key],
		};
		if (key === "state" && f.states?.length) field.options = f.states;
		if (key === "postalCode" && f.zipex) field.example = f.zipex;
		fields.push(field);
	}
	fields.push({ key: "landmark", label: "Landmark or directions", required: false });
	return fields;
}

// ─── Checking ────────────────────────────────────────────────────────────────

/** "Post town" → "post town", but "ZIP code" and "PIN code" stay as they are. */
const lower = (s: string) => (/^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);

/** What's wrong with each part, keyed by part; empty when the address is fine. */
export function addressErrors(a: PostalAddress): Partial<Record<AddressPart | "country", string>> {
	if (!isCountry(a.country)) return { country: "Pick a country" };
	const errors: Partial<Record<AddressPart, string>> = {};
	const f = formatOf(a.country);
	for (const field of addressFields(a.country)) {
		const value = a[field.key].trim();
		if (field.required && !value) {
			errors[field.key] = `Enter the ${lower(field.label)}`;
			continue;
		}
		if (!value) continue;
		if (field.options && !field.options.includes(value)) {
			errors[field.key] = `Pick a ${lower(field.label)} from the list`;
		}
		if (field.key === "postalCode" && f.zip && !new RegExp(`^(?:${f.zip})$`, "i").test(value)) {
			errors[field.key] = field.example
				? `That doesn't look like a ${lower(field.label)}, e.g. ${field.example}`
				: `That doesn't look like a ${lower(field.label)}`;
		}
	}
	return errors;
}

/** Only the parts the country uses, trimmed. */
export function cleanAddress(a: PostalAddress): PostalAddress {
	const used = new Set(addressFields(a.country).map((f) => f.key));
	const out = { ...EMPTY_ADDRESS, country: a.country };
	for (const key of used) out[key] = a[key].trim();
	return out;
}

// ─── Writing it out ──────────────────────────────────────────────────────────

/**
 * The address as the country writes it, one line per row of its format, then
 * the country and the landmark. Empty parts and their separators are dropped.
 */
export function addressLines(a: PostalAddress, { withCountry = true } = {}): string[] {
	const fmt = formatOf(a.country).fmt ?? "%A%n%C";
	const lines = fmt.split("%n").map((row) => {
		// Each row is literal text between %X tokens, e.g. "%C, %S %Z".
		const tokens = row.split(/(%[A-Z])/).filter(Boolean);
		const parts: string[] = [];
		let pendingSep = "";
		for (const t of tokens) {
			const key = t.startsWith("%") ? PART_OF[t[1]] : undefined;
			if (t.startsWith("%")) {
				const value = key ? a[key].trim() : "";
				if (!value) continue;
				parts.push((parts.length ? pendingSep : "") + value);
				pendingSep = "";
			} else {
				pendingSep = t;
			}
		}
		return parts.join("");
	});
	const out = lines
		.flatMap((l) => l.split("\n"))
		.map((l) => l.trim())
		.filter(Boolean);
	if (withCountry) out.push(countryName(a.country));
	if (a.landmark.trim()) out.push(a.landmark.trim());
	return out;
}

/** "32 QMB Builders Mart Road, Lekki Phase 1, Lagos, Nigeria" */
export const addressLine = (a: PostalAddress, options?: { withCountry?: boolean }) =>
	addressLines(a, options).join(", ");

/** A stored address, filling in anything missing or malformed. */
export function parseAddress(raw: unknown): PostalAddress {
	const r = (raw ?? {}) as Record<string, unknown>;
	const str = (k: keyof PostalAddress) => (typeof r[k] === "string" ? (r[k] as string) : "");
	const country = str("country").toUpperCase();
	return {
		country: isCountry(country) ? country : DEFAULT_COUNTRY,
		street: str("street"),
		area: str("area"),
		city: str("city"),
		state: str("state"),
		postalCode: str("postalCode"),
		sortingCode: str("sortingCode"),
		landmark: str("landmark"),
	};
}

/** True when nothing but the country has been filled in. */
export const isBlankAddress = (a: PostalAddress) =>
	(Object.keys(EMPTY_ADDRESS) as (keyof PostalAddress)[])
		.filter((k) => k !== "country")
		.every((k) => !a[k].trim());
