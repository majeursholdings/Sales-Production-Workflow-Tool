import type { PostalAddress } from "@/lib/address";

export type ClientType = "Individual" | "Trade";

export type Client = {
	id: string;
	/** First name and surname written out. */
	name: string;
	/** Set when the client was added through the form; lists only need `name`. */
	title?: string;
	firstName?: string;
	surname?: string;
	/** Phone and email as shown under the name, e.g. "+234 803 555 0142 · name@example.com". */
	contact: string;
	/** The phone in "+234…" form, for spotting duplicates. Null when it isn't a Nigerian mobile number. */
	phoneKey: string | null;
	email: string;
	type: ClientType;
	company: string;
	/** The delivery address written out, e.g. for tables and invoices. */
	location: string;
	/** The same address in parts; null for clients saved before addresses were split up. */
	addressParts?: PostalAddress | null;
	source: string;
	quotes: number;
	/** Total paid, in naira. */
	spent: number;
	last: string;
	/** Trade program tier, e.g. "Silver · 5% off". Empty for individuals. */
	tier: string;
};

export const CLIENT_SOURCES = [
	{ value: "Social media", label: "Social media" },
	{ value: "Referral", label: "Referral" },
	{ value: "Website", label: "Website" },
	{ value: "Family & friends", label: "Family & friends" },
	{ value: "Local outreach", label: "Local outreach" },
	{ value: "Showroom walk-in", label: "Showroom walk-in" },
	{ value: "Other", label: "Other" },
];
