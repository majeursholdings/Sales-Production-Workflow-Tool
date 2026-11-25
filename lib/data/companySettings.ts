import { cache } from "react";
import {
	DEFAULT_AGENT_RULES,
	DISCOUNT_WHO,
	ROUNDING_OPTIONS,
	parseTradeTiers,
	type CompanySettings,
	type DollarRate,
	type GeneralDiscount,
	type SettingsChange,
} from "@/lib/companySettings";
import { createClient } from "@/utils/supabase/server";

export const COMPANY_SETTINGS_COLUMNS =
	"logo_url, trading_name, registered_name, rc_number, tin, address, phone, whatsapp, website, require_two_step, two_step_from, idle_hours, ngn_bank, ngn_account_name, ngn_account_number, usd_bank, usd_account_number, swift, quote_terms, invoice_footer, quote_prefix, invoice_prefix, purchase_order_prefix, job_card_prefix, cost_request_prefix, po_approval_limit, agent_threshold, agent_direct_to_quote, agent_low_stock_to_procurement, agent_suggest_substitutes, from_email, sender_name, quote_email_message, whatsapp_message, cc_accounting_on_invoices";

export const PRICING_SETTINGS_COLUMNS =
	"vat_rate, deposit_rate, quote_validity_days, max_general_discount_percent, usd_exchange_rate, usd_rounding, usd_rate_set_by_label, usd_rate_set_at, trade_tiers, general_discount_who";

/** Percent from a stored rate (0.075 → 7.5), without float noise. */
const percentFromRate = (rate: unknown) => Number((Number(rate) * 100).toFixed(2));

const oneOf = <T extends string>(options: { value: T }[], value: unknown, fallback: T): T =>
	options.find((o) => o.value === value)?.value ?? fallback;

/**
 * The company settings every settings page shows: company_settings for the
 * company's own details and rules, pricing_rules for VAT, deposit, validity,
 * the dollar rate, the general discount and trade tiers (shared with the
 * Pricing page), and the change history when the viewer may see it.
 * Memoized per request.
 */
export const getCompanySettings = cache(async (): Promise<CompanySettings> => {
	const supabase = await createClient();
	const [settingsRes, pricingRes, changesRes] = await Promise.all([
		supabase.from("company_settings").select(COMPANY_SETTINGS_COLUMNS).eq("id", 1).single(),
		supabase.from("pricing_rules").select(PRICING_SETTINGS_COLUMNS).eq("id", 1).single(),
		supabase
			.from("company_settings_changes")
			.select("summary, actor_label, created_at")
			.order("created_at", { ascending: false })
			.limit(20),
	]);

	if (settingsRes.error) {
		throw new Error(`Failed to load company settings: ${settingsRes.error.message}`);
	}
	if (pricingRes.error) {
		throw new Error(`Failed to load pricing rules: ${pricingRes.error.message}`);
	}

	const s = settingsRes.data;
	const p = pricingRes.data;
	// RLS returns no rows (not an error) to people who can't see the history.
	const changes: SettingsChange[] = (changesRes.data ?? []).map((c) => ({
		by: c.actor_label,
		what: c.summary,
		at: c.created_at,
	}));

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
		changes,
	};
});
