import { cacheLife, cacheTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cacheTags";
import type { CostItem, OverheadInputs } from "@/lib/costRates";
import { getStaff } from "@/lib/data/staff";
import { hasPermission } from "@/lib/roles";
import { getCurrentUser } from "@/lib/session";
import { DEFAULT_HOURS, monthlyCost } from "@/lib/staff";
import { createAdminClient, hasAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";

type OverheadRow = {
	rent_monthly: number | string;
	power_monthly: number | string;
	other_monthly: number | string;
	hours_per_production_person: number | string;
	contingency_percent: number | string;
} | null;

async function readCachedOverheadSettings(): Promise<OverheadRow> {
	"use cache";
	cacheLife("hours");
	cacheTag(CACHE_TAGS.overheadSettings);

	const supabase = createAdminClient();
	const { data, error } = await supabase
		.from("overhead_settings")
		.select(
			"rent_monthly, power_monthly, other_monthly, hours_per_production_person, contingency_percent",
		)
		.eq("id", 1)
		.maybeSingle();

	if (error) {
		throw new Error(`Failed to load overhead settings: ${error.message}`);
	}

	return data as OverheadRow;
}

async function loadOverheadSettings(): Promise<OverheadRow> {
	const user = await getCurrentUser();
	if (!hasPermission(user.roleKey, "costs.view_full")) {
		return null;
	}

	if (hasAdminClient()) {
		return readCachedOverheadSettings();
	}

	const supabase = await createClient();
	const { data, error } = await supabase
		.from("overhead_settings")
		.select(
			"rent_monthly, power_monthly, other_monthly, hours_per_production_person, contingency_percent",
		)
		.eq("id", 1)
		.maybeSingle();

	if (error) {
		throw new Error(`Failed to load overhead settings: ${error.message}`);
	}

	return data as OverheadRow;
}

async function readCachedCostItems(): Promise<CostItem[]> {
	"use cache";
	cacheLife("hours");
	cacheTag(CACHE_TAGS.costItems);

	const supabase = createAdminClient();
	const { data, error } = await supabase
		.from("cost_items")
		.select("id, name, note, cost_type, charged_per, amount")
		.eq("is_active", true)
		.order("sort_order", { ascending: true })
		.order("created_at", { ascending: true });

	if (error) {
		throw new Error(`Failed to load cost items: ${error.message}`);
	}

	return (data ?? []).map((row) => ({
		id: row.id,
		name: row.name,
		note: row.note ?? "",
		type: row.cost_type as CostItem["type"],
		per: row.charged_per,
		amount: Number(row.amount),
	}));
}

export async function getOverheadInputs(): Promise<OverheadInputs> {
	const [staff, settings] = await Promise.all([getStaff(), loadOverheadSettings()]);

	const backend = staff.filter((p) => p.team === "Non-production");
	const production = staff.filter((p) => p.team === "Production");

	return {
		rent: Number(settings?.rent_monthly ?? 1200000),
		power: Number(settings?.power_monthly ?? 650000),
		other: Number(settings?.other_monthly ?? 250000),
		staffMonthly: backend.reduce((sum, p) => sum + monthlyCost(p), 0),
		staffCount: backend.length,
		productionCount: production.length,
		hoursEach: Number(settings?.hours_per_production_person ?? DEFAULT_HOURS),
	};
}

export async function getCostItems(): Promise<CostItem[]> {
	const user = await getCurrentUser();
	if (
		!hasPermission(user.roleKey, "costs.view_full") &&
		!hasPermission(user.roleKey, "quotes.create")
	) {
		return [];
	}

	if (hasAdminClient()) {
		return readCachedCostItems();
	}

	const supabase = await createClient();
	const { data, error } = await supabase
		.from("cost_items")
		.select("id, name, note, cost_type, charged_per, amount")
		.eq("is_active", true)
		.order("sort_order", { ascending: true })
		.order("created_at", { ascending: true });

	if (error) {
		throw new Error(`Failed to load cost items: ${error.message}`);
	}

	return (data ?? []).map((row) => ({
		id: row.id,
		name: row.name,
		note: row.note ?? "",
		type: row.cost_type as CostItem["type"],
		per: row.charged_per,
		amount: Number(row.amount),
	}));
}

export async function getContingency(): Promise<number> {
	const settings = await loadOverheadSettings();
	return Number(settings?.contingency_percent ?? 5);
}
