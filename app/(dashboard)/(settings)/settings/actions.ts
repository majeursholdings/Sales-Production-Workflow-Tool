"use server";

import dayjs from "dayjs";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { NIGERIAN_PHONE_MESSAGE, isPhoneNumber } from "@/components/forms/form.validators";
import { fail, userWith, type ActionResult } from "@/lib/actionResult";
import { CACHE_TAGS } from "@/lib/cacheTags";
import {
	DISCOUNT_WHO,
	IDLE_OPTIONS,
	NUMBERED_DOCUMENTS,
	ROUNDING_OPTIONS,
	parseCompanyAddresses,
	parseTradeTiers,
	unknownPlaceholders,
	type NumberedDocument,
	type SettingsSection,
} from "@/lib/companySettings";
import { addressErrors, addressLine, cleanAddress } from "@/lib/address";
import { formatNaira } from "@/lib/currency";
import type { SessionUser } from "@/lib/session";
import { createClient } from "@/utils/supabase/server";

const NO_ACCESS = "Only the MD or GM can change company settings.";
const LOGO_BUCKET = "company-assets";
/** Server actions take up to 1MB, so the logo has to fit under that with the other fields. */
const LOGO_MAX_BYTES = 900 * 1024;
const LOGO_TYPES: Record<string, string> = {
	"image/png": "png",
	"image/svg+xml": "svg",
	"image/jpeg": "jpg",
	"image/webp": "webp",
};

type Supabase = Awaited<ReturnType<typeof createClient>>;
type Row = Record<string, unknown>;

const naira = (n: number) => `₦${Math.round(n).toLocaleString("en-NG")}`;
const pct = (n: number) => `${n}%`;
/** 7.5 → 0.075, without float noise. */
const rateOf = (percent: number) => Number((percent / 100).toFixed(4));

function revalidateSettings(pricingToo = false) {
	updateTag(CACHE_TAGS.companySettings);
	revalidatePath("/settings", "layout");
	if (pricingToo) {
		updateTag(CACHE_TAGS.pricingRules);
		revalidatePath("/pricing");
		revalidatePath("/quotes/new", "layout");
	}
}

/** Who changed what: settings history, the audit log and, for pricing values, the Pricing page history. */
async function logChange(
	supabase: Supabase,
	actor: SessionUser,
	{
		section,
		summary,
		entityType,
		oldValues,
		newValues,
		pricing = false,
	}: {
		section: SettingsSection;
		summary: string;
		entityType: "company_settings" | "pricing_rules";
		oldValues: Row;
		newValues: Row;
		pricing?: boolean;
	},
) {
	await Promise.all([
		supabase.from("company_settings_changes").insert({
			section,
			summary,
			actor_id: actor.id,
			actor_label: actor.name,
		}),
		supabase.from("audit_logs").insert({
			actor_id: actor.id,
			action: `settings.${section}_changed`,
			entity_type: entityType,
			entity_id: "1",
			old_values: oldValues,
			new_values: newValues,
		}),
		pricing
			? supabase.from("pricing_history").insert({
					summary,
					actor_id: actor.id,
					actor_label: `${actor.name} (${actor.role})`,
				})
			: null,
	]);
}

/**
 * Updates the singleton row and returns what it held before. An update RLS
 * refuses changes no rows rather than erroring, so that's reported too.
 */
async function updateSingleton(
	supabase: Supabase,
	table: "company_settings" | "pricing_rules",
	patch: Row,
	actor: SessionUser,
	/** Other columns to read back from before the update. */
	alsoRead: string[] = [],
): Promise<{ ok: true; before: Row } | { ok: false; message: string }> {
	const columns = [...new Set([...Object.keys(patch), ...alsoRead])].join(", ");
	const { data: before, error: readError } = await supabase
		.from(table)
		.select(columns)
		.eq("id", 1)
		.single();
	if (readError || !before) return fail(readError?.message ?? "Couldn't load the settings.");

	const { data, error } = await supabase
		.from(table)
		.update({ ...patch, updated_by: actor.id })
		.eq("id", 1)
		.select("id");
	if (error) return fail(error.message);
	if (!data?.length) return fail(NO_ACCESS);
	return { ok: true, before: before as unknown as Row };
}

/** Saves one company_settings card. */
async function saveCompanySection(
	section: SettingsSection,
	patch: Row,
	summary: string | ((before: Row) => string),
): Promise<ActionResult> {
	const actor = await userWith("settings.company");
	if (!actor) return fail(NO_ACCESS);
	const supabase = await createClient();
	const res = await updateSingleton(supabase, "company_settings", patch, actor);
	if (!res.ok) return res;
	await logChange(supabase, actor, {
		section,
		summary: typeof summary === "function" ? summary(res.before) : summary,
		entityType: "company_settings",
		oldValues: res.before,
		newValues: patch,
	});
	revalidateSettings();
	return { ok: true };
}

const firstIssue = (error: z.ZodError) =>
	error.issues[0]?.message ?? "Check the values and try again.";

// ─── Company details ─────────────────────────────────────────────────────────

const optionalPhone = z
	.string()
	.trim()
	.refine((v) => !v || isPhoneNumber(v), NIGERIAN_PHONE_MESSAGE);

const detailsSchema = z.object({
	tradingName: z.string().trim().min(1, "Trading name is required"),
	registeredName: z.string().trim().min(1, "Registered name is required"),
	rcNumber: z.string().trim().max(40),
	tin: z.string().trim().max(40),
	/** Id of one of the company's addresses; empty prints none. */
	documentAddressId: z.string().trim().max(64).default(""),
	phone: optionalPhone,
	whatsapp: optionalPhone,
	website: z.string().trim().max(200),
	/** "remove" clears the logo; anything else keeps the current one unless a file is sent. */
	logo: z.enum(["keep", "remove"]).default("keep"),
});

/** Company details, sent as FormData so a new logo file can come with them. */
export async function saveCompanyDetailsAction(
	formData: FormData,
): Promise<ActionResult<{ logoUrl: string }>> {
	const actor = await userWith("settings.company");
	if (!actor) return fail(NO_ACCESS);

	const fields = Object.fromEntries(
		[...formData.entries()].filter(([, v]) => typeof v === "string"),
	);
	const parsed = detailsSchema.safeParse(fields);
	if (!parsed.success) return fail(firstIssue(parsed.error));
	const { logo, ...v } = parsed.data;

	const supabase = await createClient();
	const patch: Row = {
		trading_name: v.tradingName,
		registered_name: v.registeredName,
		rc_number: v.rcNumber,
		tin: v.tin,
		phone: v.phone,
		whatsapp: v.whatsapp,
		website: v.website,
	};

	if (v.documentAddressId) {
		const { data: row, error: addrError } = await supabase
			.from("company_settings")
			.select("addresses")
			.eq("id", 1)
			.single();
		if (addrError) return fail(addrError.message);
		const picked = parseCompanyAddresses(row?.addresses).find(
			(a) => a.id === v.documentAddressId,
		);
		if (!picked) return fail("That address was removed. Pick another one.");
		patch.document_address_id = picked.id;
		patch.address = addressLine(picked);
	} else {
		patch.document_address_id = null;
		patch.address = "";
	}

	const file = formData.get("logoFile");
	let uploadedPath: string | null = null;
	if (file instanceof File && file.size > 0) {
		const ext = LOGO_TYPES[file.type];
		if (!ext) return fail("The logo must be a PNG, SVG, JPEG or WebP image.");
		if (file.size > LOGO_MAX_BYTES) return fail("The logo must be smaller than 900 KB.");
		uploadedPath = `logo/${Date.now()}-${crypto.randomUUID()}.${ext}`;
		const { error: uploadError } = await supabase.storage
			.from(LOGO_BUCKET)
			.upload(uploadedPath, file, { contentType: file.type });
		if (uploadError) return fail(`Couldn't upload the logo: ${uploadError.message}`);
		patch.logo_url = supabase.storage
			.from(LOGO_BUCKET)
			.getPublicUrl(uploadedPath).data.publicUrl;
	} else if (logo === "remove") {
		patch.logo_url = "";
	}

	// Read logo_url too, so the reply can carry the logo the form should now show.
	const res = await updateSingleton(supabase, "company_settings", patch, actor, ["logo_url"]);
	if (!res.ok) {
		if (uploadedPath) await supabase.storage.from(LOGO_BUCKET).remove([uploadedPath]);
		return res;
	}

	// Drop the old logo file when it was one of ours and has been replaced.
	const oldUrl = String(res.before.logo_url ?? "");
	const marker = `/${LOGO_BUCKET}/`;
	if ("logo_url" in patch && oldUrl.includes(marker)) {
		await supabase.storage.from(LOGO_BUCKET).remove([oldUrl.split(marker)[1]]);
	}

	await logChange(supabase, actor, {
		section: "company",
		summary:
			"logo_url" in patch
				? "Updated company details and the document logo"
				: "Updated company details",
		entityType: "company_settings",
		oldValues: res.before,
		newValues: patch,
	});
	revalidateSettings();
	return { ok: true, data: { logoUrl: String(patch.logo_url ?? res.before.logo_url ?? "") } };
}

// ─── Sign-in policy ──────────────────────────────────────────────────────────

const signInSchema = z.object({
	requireTwoStep: z.boolean(),
	idleHours: z.coerce
		.number()
		.refine((h) => IDLE_OPTIONS.some((o) => Number(o.value) === h), "Pick a sign-out time"),
});

export async function saveSignInPolicyAction(
	raw: z.input<typeof signInSchema>,
): Promise<ActionResult> {
	const parsed = signInSchema.safeParse(raw);
	if (!parsed.success) return fail(firstIssue(parsed.error));
	const v = parsed.data;
	const actor = await userWith("settings.company");
	if (!actor) return fail(NO_ACCESS);

	const supabase = await createClient();
	const { data: current } = await supabase
		.from("company_settings")
		.select("require_two_step, two_step_from")
		.eq("id", 1)
		.single();
	// The date two-step applies from is set when it's turned on.
	const turningOn = v.requireTwoStep && !current?.require_two_step;
	const patch: Row = {
		require_two_step: v.requireTwoStep,
		idle_hours: v.idleHours,
		...(turningOn ? { two_step_from: dayjs().format("YYYY-MM-DD") } : {}),
	};

	const res = await updateSingleton(supabase, "company_settings", patch, actor);
	if (!res.ok) return res;
	await logChange(supabase, actor, {
		section: "sign_in",
		summary: v.requireTwoStep
			? `Set sign-in rules: two-step verification for every role, sign out after ${v.idleHours} hours`
			: `Set sign-in rules: two-step verification optional, sign out after ${v.idleHours} hours`,
		entityType: "company_settings",
		oldValues: res.before,
		newValues: patch,
	});
	revalidateSettings();
	return { ok: true };
}

// ─── Bank details & terms ────────────────────────────────────────────────────

const accountNumber = z
	.string()
	.transform((v) => v.replace(/\s/g, ""))
	.refine((v) => !v || /^\d{10}$/.test(v), "Account numbers have 10 digits");

const bankSchema = z.object({
	ngnBank: z.string().trim().max(100),
	ngnAccountName: z.string().trim().min(1, "Account name is required").max(200),
	ngnAccountNumber: accountNumber,
	usdBank: z.string().trim().max(100),
	usdAccountNumber: accountNumber,
	swift: z
		.string()
		.trim()
		.toUpperCase()
		.refine(
			(v) => !v || /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(v),
			"SWIFT codes are 8 or 11 letters and numbers",
		),
});

export async function saveBankDetailsAction(
	raw: z.input<typeof bankSchema>,
): Promise<ActionResult> {
	const parsed = bankSchema.safeParse(raw);
	if (!parsed.success) return fail(firstIssue(parsed.error));
	const v = parsed.data;
	return saveCompanySection(
		"bank",
		{
			ngn_bank: v.ngnBank,
			ngn_account_name: v.ngnAccountName,
			ngn_account_number: v.ngnAccountNumber,
			usd_bank: v.usdBank,
			usd_account_number: v.usdAccountNumber,
			swift: v.swift,
		},
		"Updated bank details for payment",
	);
}

const termsSchema = z.object({
	quoteTerms: z.string().trim().min(1, "Quote terms are required").max(5000),
	invoiceFooter: z.string().trim().max(2000),
});

export async function saveDocumentTermsAction(
	raw: z.input<typeof termsSchema>,
): Promise<ActionResult> {
	const parsed = termsSchema.safeParse(raw);
	if (!parsed.success) return fail(firstIssue(parsed.error));
	return saveCompanySection(
		"terms",
		{ quote_terms: parsed.data.quoteTerms, invoice_footer: parsed.data.invoiceFooter },
		"Updated quote terms and invoice footer",
	);
}

// ─── Numbering ───────────────────────────────────────────────────────────────

const PREFIX_COLUMNS: Record<NumberedDocument, string> = {
	quote: "quote_prefix",
	invoice: "invoice_prefix",
	purchaseOrder: "purchase_order_prefix",
	jobCard: "job_card_prefix",
	costRequest: "cost_request_prefix",
};

const prefix = z
	.string()
	.trim()
	.toUpperCase()
	.regex(/^[A-Z0-9-]{1,12}-$/, "Prefixes are letters, numbers and dashes, ending in a dash");

const numberingSchema = z
	.object({
		quote: prefix,
		invoice: prefix,
		purchaseOrder: prefix,
		jobCard: prefix,
		costRequest: prefix,
	})
	.refine((v) => new Set(Object.values(v)).size === NUMBERED_DOCUMENTS.length, {
		message: "Each document needs its own prefix",
	});

export async function saveNumberingAction(
	raw: z.input<typeof numberingSchema>,
): Promise<ActionResult> {
	const parsed = numberingSchema.safeParse(raw);
	if (!parsed.success) return fail(firstIssue(parsed.error));
	const v = parsed.data;
	const patch = Object.fromEntries(
		NUMBERED_DOCUMENTS.map((d) => [PREFIX_COLUMNS[d.key], v[d.key]]),
	);
	return saveCompanySection("numbering", patch, (before) => {
		const changed = NUMBERED_DOCUMENTS.filter(
			(d) => before[PREFIX_COLUMNS[d.key]] !== v[d.key],
		).map((d) => d.label.toLowerCase());
		return changed.length
			? `Changed the ${changed.join(", ")} prefix${changed.length > 1 ? "es" : ""}`
			: "Saved document numbering";
	});
}

// ─── Tax, deposit, validity & PO limit ───────────────────────────────────────

const taxSchema = z.object({
	vatPercent: z.number().min(0, "VAT is 0% to 100%").max(100, "VAT is 0% to 100%"),
	depositPercent: z.number().min(1, "Deposit is 1% to 100%").max(100, "Deposit is 1% to 100%"),
	quoteValidityDays: z.number().int("Quote validity is whole days").min(1),
	poApprovalLimit: z.number().positive("Enter a PO approval amount above ₦0"),
});

/** VAT, deposit and validity live in pricing_rules (shared with Pricing); the PO limit in company_settings. */
export async function saveTaxAction(raw: z.input<typeof taxSchema>): Promise<ActionResult> {
	const parsed = taxSchema.safeParse(raw);
	if (!parsed.success) return fail(firstIssue(parsed.error));
	const v = parsed.data;
	const actor = await userWith("settings.company");
	if (!actor) return fail(NO_ACCESS);

	const supabase = await createClient();
	const pricingPatch = {
		vat_rate: rateOf(v.vatPercent),
		deposit_rate: rateOf(v.depositPercent),
		quote_validity_days: v.quoteValidityDays,
	};
	const pricing = await updateSingleton(supabase, "pricing_rules", pricingPatch, actor);
	if (!pricing.ok) return pricing;
	const companyPatch = { po_approval_limit: v.poApprovalLimit };
	const company = await updateSingleton(supabase, "company_settings", companyPatch, actor);
	if (!company.ok) return company;

	await logChange(supabase, actor, {
		section: "tax",
		summary: `Set VAT ${pct(v.vatPercent)}, deposit ${pct(v.depositPercent)}, quotes valid ${v.quoteValidityDays} days, PO approval above ${naira(v.poApprovalLimit)}`,
		entityType: "pricing_rules",
		oldValues: { ...pricing.before, ...company.before },
		newValues: { ...pricingPatch, ...companyPatch },
		pricing: true,
	});
	revalidateSettings(true);
	return { ok: true };
}

// ─── Dollar rate ─────────────────────────────────────────────────────────────

const dollarSchema = z.object({
	rate: z.number().positive("Enter a rate above ₦0").max(9_999_999_999),
	rounding: z.enum(ROUNDING_OPTIONS.map((o) => o.value) as [string, ...string[]]),
});

/** Accounting sets the rate daily too, so this needs pricing_rules.edit rather than settings.company. */
export async function saveDollarRateAction(
	raw: z.input<typeof dollarSchema>,
): Promise<ActionResult> {
	const parsed = dollarSchema.safeParse(raw);
	if (!parsed.success) return fail(firstIssue(parsed.error));
	const v = parsed.data;
	const actor = await userWith("pricing_rules.edit");
	if (!actor) return fail("You don't have permission to change the dollar rate.");

	const supabase = await createClient();
	const patch = { usd_exchange_rate: Number(v.rate.toFixed(2)), usd_rounding: v.rounding };
	const res = await updateSingleton(supabase, "pricing_rules", patch, actor);
	if (!res.ok) return res;

	const oldRate = Number(res.before.usd_exchange_rate);
	const roundingLabel = ROUNDING_OPTIONS.find((o) => o.value === v.rounding)?.label ?? "";
	await logChange(supabase, actor, {
		section: "dollar",
		summary:
			oldRate === patch.usd_exchange_rate
				? `Set dollar prices to round to the ${roundingLabel.toLowerCase()}`
				: `Changed the dollar rate from ${formatNaira(oldRate)} to ${formatNaira(patch.usd_exchange_rate)}`,
		entityType: "pricing_rules",
		oldValues: res.before,
		newValues: patch,
		pricing: true,
	});
	revalidateSettings(true);
	return { ok: true };
}

// ─── Trade tiers & general discount ──────────────────────────────────────────

const tiersSchema = z
	.array(
		z.object({
			minSpend: z.number().positive("Enter an amount above ₦0"),
			discountPercent: z.number().min(0).max(100, "Discounts are 0% to 100%"),
		}),
	)
	.min(1);

/** Tier names are fixed; this saves each tier's threshold and discount, in order. */
export async function saveTradeTiersAction(
	raw: z.input<typeof tiersSchema>,
): Promise<ActionResult> {
	const parsed = tiersSchema.safeParse(raw);
	if (!parsed.success) return fail(firstIssue(parsed.error));
	const actor = await userWith("settings.company");
	if (!actor) return fail(NO_ACCESS);

	const supabase = await createClient();
	const { data: current, error } = await supabase
		.from("pricing_rules")
		.select("trade_tiers")
		.eq("id", 1)
		.single();
	if (error) return fail(error.message);
	const existing = parseTradeTiers(current?.trade_tiers);
	if (existing.length !== parsed.data.length) {
		return fail("The trade tiers changed while you were editing. Reload and try again.");
	}
	const tiers = existing.map((t, i) => ({ name: t.name, ...parsed.data[i] }));
	for (let i = 1; i < tiers.length; i++) {
		if (tiers[i].minSpend <= tiers[i - 1].minSpend)
			return fail(`${tiers[i].name} must start above ${tiers[i - 1].name}.`);
		if (tiers[i].discountPercent <= tiers[i - 1].discountPercent)
			return fail(`${tiers[i].name} must give more off than ${tiers[i - 1].name}.`);
	}

	const patch = { trade_tiers: tiers };
	const res = await updateSingleton(supabase, "pricing_rules", patch, actor);
	if (!res.ok) return res;
	await logChange(supabase, actor, {
		section: "trade",
		summary: `Set trade tiers: ${tiers.map((t) => `${t.name} ${pct(t.discountPercent)} from ${naira(t.minSpend)}`).join(", ")}`,
		entityType: "pricing_rules",
		oldValues: res.before,
		newValues: patch,
		pricing: true,
	});
	revalidateSettings(true);
	return { ok: true };
}

const discountSchema = z.object({
	maxPercent: z.number().min(0).max(100, "Discounts are 0% to 100%"),
	who: z.enum(DISCOUNT_WHO.map((w) => w.value) as [string, ...string[]]),
});

export async function saveGeneralDiscountAction(
	raw: z.input<typeof discountSchema>,
): Promise<ActionResult> {
	const parsed = discountSchema.safeParse(raw);
	if (!parsed.success) return fail(firstIssue(parsed.error));
	const v = parsed.data;
	const actor = await userWith("settings.company");
	if (!actor) return fail(NO_ACCESS);

	const supabase = await createClient();
	const patch = { max_general_discount_percent: v.maxPercent, general_discount_who: v.who };
	const res = await updateSingleton(supabase, "pricing_rules", patch, actor);
	if (!res.ok) return res;
	await logChange(supabase, actor, {
		section: "discount",
		summary: `Set the general discount to at most ${pct(v.maxPercent)} (${DISCOUNT_WHO.find((w) => w.value === v.who)?.label.toLowerCase()})`,
		entityType: "pricing_rules",
		oldValues: res.before,
		newValues: patch,
		pricing: true,
	});
	revalidateSettings(true);
	return { ok: true };
}

// ─── Custom design agent ─────────────────────────────────────────────────────

const agentSchema = z.object({
	threshold: z.coerce.number().int().min(50).max(100),
	directToQuote: z.boolean(),
	lowStockToProcurement: z.boolean(),
	suggestSubstitutes: z.boolean(),
});

export async function saveAgentRulesAction(
	raw: z.input<typeof agentSchema>,
): Promise<ActionResult> {
	const parsed = agentSchema.safeParse(raw);
	if (!parsed.success) return fail(firstIssue(parsed.error));
	const v = parsed.data;
	return saveCompanySection(
		"agent",
		{
			agent_threshold: v.threshold,
			agent_direct_to_quote: v.directToQuote,
			agent_low_stock_to_procurement: v.lowStockToProcurement,
			agent_suggest_substitutes: v.suggestSubstitutes,
		},
		v.directToQuote
			? `Set the custom design agent to skip procurement at ${v.threshold}% sure`
			: "Set every custom design to go to procurement first",
	);
}

// ─── Email & WhatsApp ────────────────────────────────────────────────────────

const message = (label: string) =>
	z
		.string()
		.trim()
		.min(1, `${label} is required`)
		.max(2000)
		.refine((m) => unknownPlaceholders(m).length === 0, {
			message: `${label} uses a placeholder we can't fill in`,
		});

const sendingSchema = z.object({
	fromEmail: z.union([z.literal(""), z.email("Enter a valid email address")]),
	senderName: z.string().trim().min(1, "Sender name is required").max(100),
	quoteEmail: message("Quote email message"),
	whatsappMessage: message("WhatsApp message"),
	ccAccountingOnInvoices: z.boolean(),
});

export async function saveSendingAction(raw: z.input<typeof sendingSchema>): Promise<ActionResult> {
	const parsed = sendingSchema.safeParse({ ...raw, fromEmail: raw.fromEmail?.trim() });
	if (!parsed.success) return fail(firstIssue(parsed.error));
	const v = parsed.data;
	return saveCompanySection(
		"sending",
		{
			from_email: v.fromEmail,
			sender_name: v.senderName,
			quote_email_message: v.quoteEmail,
			whatsapp_message: v.whatsappMessage,
			cc_accounting_on_invoices: v.ccAccountingOnInvoices,
		},
		"Updated the quote email and WhatsApp messages",
	);
}

// ─── Addresses ───────────────────────────────────────────────────────────────

const addressSchema = z.object({
	id: z.string().trim().min(1).max(64),
	name: z.string().trim().min(1, "Give every address a name").max(60),
	country: z.string().trim().length(2),
	street: z.string().max(300).default(""),
	area: z.string().max(120).default(""),
	city: z.string().max(120).default(""),
	state: z.string().max(120).default(""),
	postalCode: z.string().max(20).default(""),
	sortingCode: z.string().max(20).default(""),
	landmark: z.string().max(200).default(""),
});

const addressesSchema = z
	.array(addressSchema)
	.max(20, "Keep it to 20 addresses or fewer")
	.superRefine((list, ctx) => {
		const names = new Set<string>();
		for (const a of list) {
			const name = a.name.toLowerCase();
			if (names.has(name)) {
				ctx.addIssue({ code: "custom", message: `Two addresses are called "${a.name}"` });
			}
			names.add(name);
			const problem = Object.values(addressErrors(a))[0];
			if (problem) ctx.addIssue({ code: "custom", message: `${a.name}: ${problem}` });
		}
		if (new Set(list.map((a) => a.id)).size !== list.length) {
			ctx.addIssue({
				code: "custom",
				message: "Two addresses share an id. Reload and try again.",
			});
		}
	});

/**
 * The company's addresses. The first is the default delivery address on new
 * purchase orders; if the one printed on documents changed, its written-out
 * copy (`address`) is updated too.
 */
export async function saveAddressesAction(
	raw: z.input<typeof addressesSchema>,
): Promise<ActionResult> {
	const parsed = addressesSchema.safeParse(raw);
	if (!parsed.success) return fail(firstIssue(parsed.error));
	const actor = await userWith("settings.company");
	if (!actor) return fail(NO_ACCESS);
	const list = parsed.data.map((a) => ({ ...a, ...cleanAddress(a), name: a.name.trim() }));

	const supabase = await createClient();
	const { data: current, error } = await supabase
		.from("company_settings")
		.select("document_address_id")
		.eq("id", 1)
		.single();
	if (error) return fail(error.message);
	const documentId = current?.document_address_id as string | null;
	const printed = list.find((a) => a.id === documentId);
	if (documentId && !printed) {
		return fail(
			"That address is printed on documents. Pick another one under Company details first, then remove it.",
		);
	}

	const patch: Row = { addresses: list, ...(printed && { address: addressLine(printed) }) };
	const res = await updateSingleton(supabase, "company_settings", patch, actor);
	if (!res.ok) return res;

	await logChange(supabase, actor, {
		section: "addresses",
		summary: list.length
			? `Set company addresses: ${list.map((a) => a.name).join(", ")}`
			: "Removed all company addresses",
		entityType: "company_settings",
		oldValues: res.before,
		newValues: patch,
	});
	revalidateSettings();
	revalidatePath("/purchase-orders", "layout");
	return { ok: true };
}
