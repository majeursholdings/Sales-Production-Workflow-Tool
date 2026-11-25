import dayjs from "dayjs";
import { getFurnitureCatalog, getOtherCostOptions } from "@/lib/data/furnitureTypes";
import {
	DEPOSIT_RATE,
	MAX_GENERAL_DISCOUNT,
	USD_RATE,
	VALID_DAYS,
	nextQuoteNumber,
	quoteDateLabel,
	quoteDatePrefix,
	toCatalog,
	type BuilderRates,
	type CatalogItem,
	type QuoteBuilderSetup,
	type QuoteHeader,
} from "@/lib/quoteBuilder";
import { VAT_RATE } from "@/lib/quotes";
import { getCompanySettings } from "@/lib/data/companySettings";
import { createClient } from "@/utils/supabase/server";

type QuoteRules = Omit<BuilderRates, "contingency" | "overheadPerLabourHour">;

/** VAT, deposit, validity, discount limit and USD rate from `public.pricing_rules`. */
export async function getQuoteRules(): Promise<QuoteRules> {
	const supabase = await createClient();
	const { data, error } = await supabase
		.from("pricing_rules")
		.select(
			"vat_rate, deposit_rate, quote_validity_days, max_general_discount_percent, usd_exchange_rate",
		)
		.eq("id", 1)
		.maybeSingle();
	if (error) throw new Error(`Failed to load pricing rules: ${error.message}`);

	return {
		vatRate: Number(data?.vat_rate ?? VAT_RATE),
		depositRate: Number(data?.deposit_rate ?? DEPOSIT_RATE),
		validDays: Number(data?.quote_validity_days ?? VALID_DAYS),
		maxDiscount: Number(data?.max_general_discount_percent ?? MAX_GENERAL_DISCOUNT),
		usdRate: Number(data?.usd_exchange_rate ?? USD_RATE),
	};
}

/** Published furniture types and the rates quotes are priced with. */
export async function getBuilderCatalog(): Promise<{
	catalog: CatalogItem[];
	rates: BuilderRates;
}> {
	const [furniture, rules] = await Promise.all([
		getFurnitureCatalog({ publishedOnly: true }),
		getQuoteRules(),
	]);
	return {
		catalog: toCatalog(furniture),
		rates: {
			...rules,
			contingency: furniture.rates.contingency,
			overheadPerLabourHour: furniture.rates.overheadPerLabourHour,
		},
	};
}

/** The next unused quote number for today, checked against `public.quotes`. */
export async function getNextQuoteNumber(day = dayjs()): Promise<string> {
	const supabase = await createClient();
	const docPrefix = (await getCompanySettings()).numbering.quote;
	const { data, error } = await supabase
		.from("quotes")
		.select("quote_number")
		.like("quote_number", `${quoteDatePrefix(day, docPrefix)}%`);
	if (error) throw new Error(`Failed to check quote numbers: ${error.message}`);
	return nextQuoteNumber(
		(data ?? []).map((r) => r.quote_number as string),
		day,
		docPrefix,
	);
}

export const headerFor = (number: string, validDays: number, issued = dayjs()): QuoteHeader => ({
	number,
	issued: quoteDateLabel(issued),
	validUntil: quoteDateLabel(issued.add(validDays, "day")),
});

export async function getQuoteBuilderSetup(): Promise<QuoteBuilderSetup> {
	const [{ catalog, rates }, costItems, number] = await Promise.all([
		getBuilderCatalog(),
		getOtherCostOptions(),
		getNextQuoteNumber(),
	]);
	return {
		catalog,
		rates,
		projectCostOptions: costItems.map((c) => ({
			id: c.id,
			name: c.name,
			type: c.type,
			per: c.per,
			amount: c.amount,
		})),
		header: headerFor(number, rates.validDays),
	};
}
