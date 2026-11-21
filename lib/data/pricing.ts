import dayjs from "dayjs";
import type { MarkupCategory, PricingChange, PricingRule } from "@/lib/pricing";
import { DEPOSIT_RATE, MAX_GENERAL_DISCOUNT, USD_RATE, VALID_DAYS } from "@/lib/quoteBuilder";
import { VAT_RATE } from "@/lib/quotes";
import { createClient } from "@/utils/supabase/server";

export async function getMarkupCategories(): Promise<MarkupCategory[]> {
	const supabase = await createClient();
	const { data, error } = await supabase
		.from("markup_categories")
		.select("id, name, furniture_types_count, markup_percent, ceiling_percent, example_cost")
		.order("sort_order", { ascending: true })
		.order("name", { ascending: true });

	if (error) {
		throw new Error(`Failed to load markup categories: ${error.message}`);
	}

	return (data ?? []).map((row) => ({
		id: row.id,
		name: row.name,
		types: Number(row.furniture_types_count),
		markup: Number(row.markup_percent),
		ceiling: Number(row.ceiling_percent),
		exampleCost: Number(row.example_cost),
	}));
}

export async function getPricingRules(): Promise<PricingRule[]> {
	const supabase = await createClient();
	const { data, error } = await supabase
		.from("pricing_rules")
		.select(
			"vat_rate, deposit_rate, quote_validity_days, max_general_discount_percent, trade_tiers_label, usd_exchange_rate",
		)
		.eq("id", 1)
		.maybeSingle();

	if (error) {
		throw new Error(`Failed to load pricing rules: ${error.message}`);
	}

	const vatRate = Number(data?.vat_rate ?? VAT_RATE);
	const depositRate = Number(data?.deposit_rate ?? DEPOSIT_RATE);
	const validDays = Number(data?.quote_validity_days ?? VALID_DAYS);
	const maxDiscount = Number(data?.max_general_discount_percent ?? MAX_GENERAL_DISCOUNT);
	const tradeTiers = data?.trade_tiers_label ?? "5 / 10 / 20%";
	const usdRate = Number(data?.usd_exchange_rate ?? USD_RATE);

	return [
		{ label: "VAT", who: "Set by Accounting", value: `${Number((vatRate * 100).toFixed(2))}%` },
		{
			label: "Deposit to confirm",
			who: "Accounting, MD and GM",
			value: `${Math.round(depositRate * 100)}%`,
		},
		{ label: "Quote validity", who: "MD or GM only", value: `${validDays} days` },
		{
			label: "General discount",
			who: "Most staff can give; not for trade clients",
			value: `Up to ${maxDiscount}%`,
		},
		{
			label: "Trade tiers",
			who: "Paid in the last 365 days since joining",
			value: tradeTiers,
		},
		{
			label: "USD rate",
			who: "Set daily by Accounting",
			value: `₦${usdRate.toLocaleString("en-NG")} / $`,
		},
	];
}

export async function getPricingHistory(): Promise<PricingChange[]> {
	const supabase = await createClient();
	const { data, error } = await supabase
		.from("pricing_history")
		.select("summary, actor_label, created_at")
		.order("created_at", { ascending: false })
		.limit(20);

	if (error) {
		throw new Error(`Failed to load pricing history: ${error.message}`);
	}

	return (data ?? []).map((row) => ({
		what: row.summary,
		who: `${row.actor_label} · ${dayjs(row.created_at).format("D MMM YYYY, HH:mm")}`,
	}));
}
