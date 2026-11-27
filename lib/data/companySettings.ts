import { cache } from "react";
import { cacheLife, cacheTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cacheTags";
import {
	DEFAULT_AGENT_RULES,
	DISCOUNT_WHO,
	ROUNDING_OPTIONS,
	parseCompanyAddresses,
	parseTradeTiers,
	type CompanySettings,
	type DollarRate,
	type GeneralDiscount,
	type SettingsChange,
} from "@/lib/companySettings";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient, hasAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";

export const COMPANY_SETTINGS_COLUMNS =
	"logo_url, trading_name, registered_name, rc_number, tin, address, phone, whatsapp, website, require_two_step, two_step_from, idle_hours, ngn_bank, ngn_account_name, ngn_account_number, usd_bank, usd_account_number, swift, quote_terms, invoice_footer, quote_prefix, invoice_prefix, purchase_order_prefix, job_card_prefix, cost_request_prefix, po_approval_limit, agent_threshold, agent_direct_to_quote, agent_low_stock_to_procurement, agent_suggest_substitutes, from_email, sender_name, quote_email_message, whatsapp_message, cc_accounting_on_invoices, addresses, document_address_id";

export const PRICING_SETTINGS_COLUMNS =
	"vat_rate, deposit_rate, quote_validity_days, max_general_discount_percent, trade_tiers_label, usd_exchange_rate, usd_rounding, usd_rate_set_by_label, usd_rate_set_at, trade_tiers, general_discount_who";

export type PricingRulesRow = {
	vat_rate: number | string;
	deposit_rate: number | string;
	quote_validity_days: number | string;
	max_general_discount_percent: number | string;
	trade_tiers_label: string | null;
	usd_exchange_rate: number | string;
	usd_rounding: string | null;
	usd_rate_set_by_label: string | null;
	usd_rate_set_at: string | null;
	trade_tiers: unknown;
	general_discount_who: string | null;
};

type CompanySettingsRow = {
	logo_url: string;
	trading_name: string;
	registered_name: string;
	rc_number: string;
	tin: string;
	address: string;
	phone: string;
	whatsapp: string;
	website: string;
	require_two_step: boolean;
	two_step_from: string | null;
	idle_hours: number | string;
	ngn_bank: string;
	ngn_account_name: string;
	ngn_account_number: string;
	usd_bank: string;
	usd_account_number: string;
	swift: string;
	quote_terms: string;
	invoice_footer: string;
	quote_prefix: string;
	invoice_prefix: string;
	purchase_order_prefix: string;
	job_card_prefix: string;
	cost_request_prefix: string;
	po_approval_limit: number | string;
	agent_threshold: number | string | null;
	agent_direct_to_quote: boolean;
	agent_low_stock_to_procurement: boolean;
	agent_suggest_substitutes: boolean;
	from_email: string;
	sender_name: string;
	quote_email_message: string;
	whatsapp_message: string;
	cc_accounting_on_invoices: boolean;
	addresses: unknown;
	document_address_id: string | null;
};

/** Percent from a stored rate (0.075 → 7.5), without float noise. */
const percentFromRate = (rate: unknown) => Number((Number(rate) * 100).toFixed(2));

const oneOf = <T extends string>(options: { value: T }[], value: unknown, fallback: T): T =>
	options.find((o) => o.value === value)?.value ?? fallback;

/** Shared singleton company_settings row (identical for all active authenticated staff). */
async function readCachedCompanySettingsRow(): Promise<CompanySettingsRow> {
	"use cache";
	cacheLife("hours");
	cacheTag(CACHE_TAGS.companySettings);

	const supabase = createAdminClient();
	const { data, error } = await supabase
		.from("company_settings")
		.select(COMPANY_SETTINGS_COLUMNS)
		.eq("id", 1)
		.single();
	if (error) throw new Error(`Failed to load company settings: ${error.message}`);
	return data as unknown as CompanySettingsRow;
}

/** Shared singleton pricing_rules row (identical for all active authenticated staff). */
async function readCachedPricingRulesRow(): Promise<PricingRulesRow> {
	"use cache";
	cacheLife("minutes");
	cacheTag(CACHE_TAGS.pricingRules);

	const supabase = createAdminClient();
	const { data, error } = await supabase
		.from("pricing_rules")
		.select(PRICING_SETTINGS_COLUMNS)
		.eq("id", 1)
		.single();
	if (error) throw new Error(`Failed to load pricing rules: ${error.message}`);
	return data as unknown as PricingRulesRow;
}

/**
 * Company-wide sign-in rules (`require_two_step` and `idle_hours`).
 * Safe to call during sign-in, link verification, and lockout review without
 * requiring a settled dashboard session.
 */
export const getSignInPolicy = cache(
	async (): Promise<{ requireTwoStep: boolean; idleHours: number }> => {
		try {
			const row = await loadCompanySettingsRow();
			const hours = Number(row.idle_hours);
			return {
				requireTwoStep: Boolean(row.require_two_step),
				idleHours: Number.isFinite(hours) && hours > 0 ? hours : 12,
			};
		} catch {
			return { requireTwoStep: false, idleHours: 12 };
		}
	},
);

async function loadCompanySettingsRow(): Promise<CompanySettingsRow> {
	if (hasAdminClient()) return readCachedCompanySettingsRow();
	const supabase = await createClient();
	const { data, error } = await supabase
		.from("company_settings")
		.select(COMPANY_SETTINGS_COLUMNS)
		.eq("id", 1)
		.single();
	if (error) throw new Error(`Failed to load company settings: ${error.message}`);
	return data as unknown as CompanySettingsRow;
}

/**
 * Authenticated, cached read of `public.pricing_rules` (id = 1).
 * Shared by Settings, Pricing & Margins, and the Quote Builder.
 */
export const getPricingRulesRow = cache(async (): Promise<PricingRulesRow> => {
	await getCurrentUser();
	if (hasAdminClient()) return readCachedPricingRulesRow();
	const supabase = await createClient();
	const { data, error } = await supabase
		.from("pricing_rules")
		.select(PRICING_SETTINGS_COLUMNS)
		.eq("id", 1)
		.single();
	if (error) throw new Error(`Failed to load pricing rules: ${error.message}`);
	return data as unknown as PricingRulesRow;
});

function buildCompanySettings(
	s: CompanySettingsRow,
	p: PricingRulesRow,
	changes: SettingsChange[],
): CompanySettings {
	return {
		details: {
			logoUrl: s.logo_url,
			tradingName: s.trading_name,
			registeredName: s.registered_name,
			rcNumber: s.rc_number,
			tin: s.tin,
			address: s.address,
			phone: s.phone,
			whatsapp: s.whatsapp,
			website: s.website,
		},
		signIn: {
			requireTwoStep: s.require_two_step,
			twoStepFrom: s.two_step_from ?? "",
			idleHours: Number(s.idle_hours),
		},
		bank: {
			ngnBank: s.ngn_bank,
			ngnAccountName: s.ngn_account_name,
			ngnAccountNumber: s.ngn_account_number,
			usdBank: s.usd_bank,
			usdAccountNumber: s.usd_account_number,
			swift: s.swift,
		},
		terms: { quoteTerms: s.quote_terms, invoiceFooter: s.invoice_footer },
		numbering: {
			quote: s.quote_prefix,
			invoice: s.invoice_prefix,
			purchaseOrder: s.purchase_order_prefix,
			jobCard: s.job_card_prefix,
			costRequest: s.cost_request_prefix,
		},
		tax: {
			vatPercent: percentFromRate(p.vat_rate),
			depositPercent: percentFromRate(p.deposit_rate),
			quoteValidityDays: Number(p.quote_validity_days),
			poApprovalLimit: Number(s.po_approval_limit),
		},
		dollar: {
			rate: Number(p.usd_exchange_rate),
			setBy: p.usd_rate_set_by_label ?? "",
			setAt: p.usd_rate_set_at ?? "",
			rounding: oneOf<DollarRate["rounding"]>(ROUNDING_OPTIONS, p.usd_rounding, "1"),
		},
		tiers: parseTradeTiers(p.trade_tiers),
		generalDiscount: {
			maxPercent: Number(p.max_general_discount_percent),
			who: oneOf<GeneralDiscount["who"]>(
				DISCOUNT_WHO,
				p.general_discount_who,
				"care-and-sales",
			),
		},
		agent: {
			threshold: Number(s.agent_threshold ?? DEFAULT_AGENT_RULES.threshold),
			directToQuote: s.agent_direct_to_quote,
			lowStockToProcurement: s.agent_low_stock_to_procurement,
			suggestSubstitutes: s.agent_suggest_substitutes,
		},
		sending: {
			fromEmail: s.from_email,
			senderName: s.sender_name,
			quoteEmail: s.quote_email_message,
			whatsappMessage: s.whatsapp_message,
			ccAccountingOnInvoices: s.cc_accounting_on_invoices,
		},
		addresses: parseCompanyAddresses(s.addresses),
		documentAddressId: s.document_address_id ?? "",
		changes,
	};
}

/**
 * Cached company & pricing configuration without the RLS-filtered change history.
 * Use this for numbering prefixes, PO approval limits, bank details, and document terms.
 */
export const getCompanyConfig = cache(async (): Promise<CompanySettings> => {
	await getCurrentUser();
	const [s, p] = await Promise.all([loadCompanySettingsRow(), getPricingRulesRow()]);
	return buildCompanySettings(s, p, []);
});

/**
 * Full company settings for Settings pages: reuses the cached singleton config
 * and queries only the RLS-protected change history per request.
 */
export const getCompanySettings = cache(async (): Promise<CompanySettings> => {
	const [config, supabase] = await Promise.all([getCompanyConfig(), createClient()]);
	const { data } = await supabase
		.from("company_settings_changes")
		.select("summary, actor_label, created_at")
		.order("created_at", { ascending: false })
		.limit(20);

	// RLS returns no rows (not an error) to people who can't see the history.
	const changes: SettingsChange[] = (data ?? []).map((c) => ({
		by: c.actor_label,
		what: c.summary,
		at: c.created_at,
	}));

	return { ...config, changes };
});
