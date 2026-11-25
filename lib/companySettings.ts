import dayjs from "dayjs";
import { CONFIDENCE_THRESHOLD } from "@/lib/costRequests";

// ─── Types ───────────────────────────────────────────────────────────────────

export type CompanyDetails = {
	logoUrl: string;
	tradingName: string;
	registeredName: string;
	rcNumber: string;
	tin: string;
	address: string;
	phone: string;
	whatsapp: string;
	website: string;
};

export type SignInPolicy = {
	requireTwoStep: boolean;
	/** ISO date it applies from; empty when it has never been turned on. */
	twoStepFrom: string;
	/** Hours without activity before people are signed out. */
	idleHours: number;
};

export type BankDetails = {
	ngnBank: string;
	ngnAccountName: string;
	ngnAccountNumber: string;
	usdBank: string;
	usdAccountNumber: string;
	swift: string;
};

export type DocumentTerms = { quoteTerms: string; invoiceFooter: string };

export type NumberedDocument = "quote" | "invoice" | "purchaseOrder" | "jobCard" | "costRequest";

export type Numbering = Record<NumberedDocument, string>;

export type TaxSettings = {
	vatPercent: number;
	depositPercent: number;
	quoteValidityDays: number;
	poApprovalLimit: number;
};

export type DollarRate = {
	/** Naira per $1. */
	rate: number;
	/** Who last changed the rate; empty when it's never been changed. */
	setBy: string;
	/** ISO date-time of the last change; empty when it's never been changed. */
	setAt: string;
	rounding: "1" | "0.01" | "5";
};

export type TradeTier = { name: string; minSpend: number; discountPercent: number };

export type GeneralDiscount = {
	maxPercent: number;
	who: "care-and-sales" | "sales" | "owners";
};

export type AgentRules = {
	/** % the agent must be sure of every part to skip procurement. */
	threshold: number;
	directToQuote: boolean;
	lowStockToProcurement: boolean;
	suggestSubstitutes: boolean;
};

export type SendingSettings = {
	fromEmail: string;
	senderName: string;
	quoteEmail: string;
	whatsappMessage: string;
	ccAccountingOnInvoices: boolean;
};

/** Which settings card a change was made in. */
export type SettingsSection =
	| "company"
	| "sign_in"
	| "bank"
	| "terms"
	| "numbering"
	| "tax"
	| "dollar"
	| "trade"
	| "discount"
	| "agent"
	| "sending";

export type SettingsChange = { by: string; what: string; at: string };

export type CompanySettings = {
	details: CompanyDetails;
	signIn: SignInPolicy;
	bank: BankDetails;
	terms: DocumentTerms;
	numbering: Numbering;
	tax: TaxSettings;
	dollar: DollarRate;
	tiers: TradeTier[];
	generalDiscount: GeneralDiscount;
	agent: AgentRules;
	sending: SendingSettings;
	/** Newest first. Empty for people who can't see the history. */
	changes: SettingsChange[];
};

// ─── Labels and defaults ─────────────────────────────────────────────────────

export const NUMBERED_DOCUMENTS: { key: NumberedDocument; label: string }[] = [
	{ key: "quote", label: "Quote" },
	{ key: "invoice", label: "Invoice" },
	{ key: "purchaseOrder", label: "Purchase order" },
	{ key: "jobCard", label: "Job card" },
	{ key: "costRequest", label: "Cost request" },
];

/** What the next number looks like: the prefix, then the date and time (cost requests count up). */
export function nextNumber(doc: NumberedDocument, prefix: string, now: string, lastRequest = 0) {
	const t = dayjs(now);
	if (doc === "costRequest") return `${prefix}${String(lastRequest + 1).padStart(4, "0")}`;
	if (doc === "jobCard") return `${prefix}${t.format("YYYYMMDD")}-0001`;
	return `${prefix}${t.format("YYYYMMDD-HHmm")}`;
}

export const IDLE_OPTIONS = [4, 8, 12, 24].map((h) => ({
	value: String(h),
	label: `${h} hours without activity`,
}));

export const ROUNDING_OPTIONS: { value: DollarRate["rounding"]; label: string }[] = [
	{ value: "1", label: "Nearest $1" },
	{ value: "0.01", label: "Nearest $0.01" },
	{ value: "5", label: "Nearest $5" },
];

export const DISCOUNT_WHO: { value: GeneralDiscount["who"]; label: string }[] = [
	{ value: "care-and-sales", label: "Customer care and sales" },
	{ value: "sales", label: "Sales only" },
	{ value: "owners", label: "MD and GM only" },
];

/** Trade tiers new installs start with (matches the pricing_rules.trade_tiers default). */
export const DEFAULT_TIERS: TradeTier[] = [
	{ name: "Silver", minSpend: 20_000_000, discountPercent: 5 },
	{ name: "Gold", minSpend: 50_000_000, discountPercent: 10 },
	{ name: "Platinum", minSpend: 100_000_000, discountPercent: 20 },
];

export const DEFAULT_AGENT_RULES: AgentRules = {
	threshold: CONFIDENCE_THRESHOLD,
	directToQuote: true,
	lowStockToProcurement: false,
	suggestSubstitutes: true,
};

/** The agent rules in one sentence, as they stand. */
export function agentRuleSummary(r: AgentRules) {
	if (!r.directToQuote)
		return "Right now: every custom design goes to procurement before it can go on a quote, whatever the agent's confidence.";
	return `Right now: a custom design goes straight on the quote when every part is in inventory${r.lowStockToProcurement ? " with enough stock" : ""} and the agent is at least ${r.threshold}% sure of each part. Anything else goes to procurement first. Changes apply to new custom designs; lines already on quotes keep the rule they were built with.`;
}

/** Placeholders a message can use; each fills in from the quote when it's sent. */
export const MESSAGE_PLACEHOLDERS = [
	"client first name",
	"quote number",
	"valid until",
	"prepared by",
	"link",
] as const;

/** Placeholders in a message that aren't in MESSAGE_PLACEHOLDERS, e.g. a typo like {qoute number}. */
export function unknownPlaceholders(message: string) {
	const used = [...message.matchAll(/\{([^}]*)\}/g)].map((m) => m[1].trim().toLowerCase());
	return used.filter((p) => !(MESSAGE_PLACEHOLDERS as readonly string[]).includes(p));
}

/** Trade tiers from pricing_rules.trade_tiers (jsonb), skipping anything malformed, lowest first. */
export function parseTradeTiers(raw: unknown): TradeTier[] {
	if (!Array.isArray(raw)) return [];
	return raw
		.map((t) => ({
			name: String(t?.name ?? "").trim(),
			minSpend: Number(t?.minSpend),
			discountPercent: Number(t?.discountPercent),
		}))
		.filter((t) => t.name && Number.isFinite(t.minSpend) && Number.isFinite(t.discountPercent))
		.sort((a, b) => a.minSpend - b.minSpend);
}
