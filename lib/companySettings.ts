import dayjs from "dayjs";
import { CONFIDENCE_THRESHOLD } from "@/lib/costRequests";
import { VAT_RATE } from "@/lib/finance";
import { PO_APPROVAL_LIMIT } from "@/lib/inventory";

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
	/** ISO date it applies from. */
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
	setBy: string;
	/** ISO date-time. */
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
	/** Newest first. */
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
export function nextNumber(doc: NumberedDocument, prefix: string, now: string, lastRequest = 14) {
	const t = dayjs(now);
	if (doc === "costRequest") return `${prefix}${String(lastRequest + 1).padStart(4, "0")}`;
	if (doc === "jobCard") return `${prefix}${t.format("YYYYMMDD")}-0032`;
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

// ─── Sample data ─────────────────────────────────────────────────────────────
// TODO: replace with a company_settings table. Values are the design's sample;
// the ones the app already uses elsewhere (VAT, deposit, PO approval limit,
// agent threshold) come from those constants so the pages agree. Fields the
// design left as placeholders ([RC NUMBER], [TIN], …) start empty.

const SETTINGS: CompanySettings = {
	details: {
		logoUrl: "/majeurs-logo-black.png",
		tradingName: "Majeurs",
		registeredName: "Majeurs Holdings Ltd",
		rcNumber: "",
		tin: "",
		address: "",
		phone: "",
		whatsapp: "",
		website: "majeursholdings.com",
	},
	signIn: { requireTwoStep: true, twoStepFrom: "2026-11-14", idleHours: 12 },
	bank: {
		ngnBank: "",
		ngnAccountName: "Majeurs Holdings Ltd",
		ngnAccountNumber: "",
		usdBank: "",
		usdAccountNumber: "",
		swift: "",
	},
	terms: {
		quoteTerms:
			"This quote is valid for 7 days. A 70% deposit confirms the order and starts production. The balance is due before delivery. Lead times start from the deposit date. Prices for custom items are fixed once the quote is accepted.",
		invoiceFooter:
			"Thank you for choosing Majeurs. Please use the invoice number as your transfer reference.",
	},
	numbering: {
		quote: "MAJ-QT-",
		invoice: "MAJ-INV-",
		purchaseOrder: "MAJ-PO-",
		jobCard: "JC-",
		costRequest: "CR-",
	},
	tax: {
		vatPercent: VAT_RATE * 100,
		depositPercent: 70,
		quoteValidityDays: 7,
		poApprovalLimit: PO_APPROVAL_LIMIT,
	},
	dollar: { rate: 1460, setBy: "Bisi Lawal", setAt: "2026-11-07T09:10:00", rounding: "1" },
	tiers: DEFAULT_TIERS,
	generalDiscount: { maxPercent: 3, who: "care-and-sales" },
	agent: DEFAULT_AGENT_RULES,
	sending: {
		fromEmail: "quotes@majeursholdings.com",
		senderName: "Majeurs",
		quoteEmail:
			"Hi {client first name}, thank you for choosing Majeurs. Your quote {quote number} is attached and valid until {valid until}. Reply to this email or message us on WhatsApp with any questions. {prepared by}",
		whatsappMessage:
			"Hi {client first name}, here's your Majeurs quote {quote number}: {link}. It's valid until {valid until}.",
		ccAccountingOnInvoices: true,
	},
	changes: [
		{
			by: "Bisi Lawal",
			what: "Changed the dollar rate from ₦1,455.00 to ₦1,460.00",
			at: "2026-11-07T09:10:00",
		},
		{
			by: "Femi Ogunleye",
			what: "Turned on two-step verification for every role",
			at: "2026-11-06T16:20:00",
		},
		{ by: "Amaka Udeh", what: "Updated quote terms", at: "2026-11-02T11:45:00" },
	],
};

export async function getCompanySettings(): Promise<CompanySettings> {
	return SETTINGS;
}
