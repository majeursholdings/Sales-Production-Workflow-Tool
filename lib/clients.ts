import { normalizeNigerianPhone } from "@/components/forms/form.validators";

export type ClientType = "Individual" | "Trade";

export type Client = {
	id: string;
	name: string;
	/** Phone and email as shown under the name, e.g. "+234 803 555 0142 · name@example.com". */
	contact: string;
	/** The phone in "+234…" form, for spotting duplicates. Null when it isn't a Nigerian mobile number. */
	phoneKey: string | null;
	email: string;
	type: ClientType;
	company: string;
	location: string;
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

const sample = (
	id: string,
	name: string,
	phone: string,
	email: string,
	type: ClientType,
	company: string,
	location: string,
	source: string,
	quotes: number,
	spent: number,
	last: string,
	tier = "",
): Client => ({
	id,
	name,
	contact: [phone, email].filter(Boolean).join(" · "),
	phoneKey: normalizeNigerianPhone(phone),
	email,
	type,
	company,
	location,
	source,
	quotes,
	spent,
	last,
	tier,
});

/**
 * TODO: replace with real clients once there's a backend.
 * The sample clients from the design, most recent activity first. The page
 * only reads clients through here, so swapping in real data is a one-file change.
 */
const SAMPLE_CLIENTS: Client[] = [
	sample(
		"c-1",
		"Adaeze Okafor",
		"+234 803 555 0142",
		"adaeze.okafor@gmail.com",
		"Trade",
		"Okafor Interiors Studio",
		"Lekki Phase 1, Lagos",
		"Referral",
		4,
		1842000,
		"Quote drafted today",
		"Starter · no discount yet",
	),
	sample(
		"c-2",
		"Tunde Bakare",
		"+234 802 314 7760",
		"tunde.bakare@outlook.com",
		"Individual",
		"",
		"GRA Ikeja, Lagos",
		"Instagram",
		1,
		1451250,
		"Deposit recorded 7 Nov",
	),
	sample(
		"c-3",
		"Harbourview Suites",
		"+234 1 271 0040",
		"",
		"Trade",
		"Harbourview Hotels Ltd",
		"Victoria Island, Lagos",
		"Local outreach",
		2,
		8940000,
		"In production",
		"Starter · no discount yet",
	),
	sample(
		"c-4",
		"Moyo & Okeke Interiors",
		"+234 809 118 2290",
		"",
		"Trade",
		"Moyo & Okeke Interiors",
		"Ikoyi, Lagos",
		"Website",
		9,
		21460500,
		"Order ready 12 Nov",
		"Silver · 5% off",
	),
	sample(
		"c-5",
		"Fatima Bello",
		"+234 805 330 7781",
		"",
		"Individual",
		"",
		"Asokoro, Abuja",
		"Family & friends",
		1,
		0,
		"Quote sent 5 Nov",
	),
	sample(
		"c-6",
		"Ngozi Adeyemi",
		"+234 809 123 4455",
		"",
		"Individual",
		"",
		"Magodo, Lagos",
		"TikTok",
		1,
		0,
		"Quote expires 8 Nov",
	),
	sample(
		"c-7",
		"Kola Martins",
		"+234 813 004 5521",
		"",
		"Trade",
		"Martins & Co.",
		"Yaba, Lagos",
		"Showroom walk-in",
		1,
		0,
		"Quote expired 4 Nov",
		"Starter · no discount yet",
	),
];

export async function getClients(): Promise<Client[]> {
	return SAMPLE_CLIENTS;
}
