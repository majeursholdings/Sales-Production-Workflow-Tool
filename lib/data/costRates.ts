import type { CostItem, OverheadInputs } from "@/lib/costRates";
import { getStaff } from "@/lib/data/staff";
import { DEFAULT_HOURS, monthlyCost } from "@/lib/staff";
import { createClient } from "@/utils/supabase/server";

export async function getOverheadInputs(): Promise<OverheadInputs> {
	const supabase = await createClient();
	const [staff, { data: settings, error }] = await Promise.all([
		getStaff(),
		supabase
			.from("overhead_settings")
			.select("rent_monthly, power_monthly, other_monthly, hours_per_production_person")
			.eq("id", 1)
			.maybeSingle(),
	]);

	if (error) {
		throw new Error(`Failed to load overhead settings: ${error.message}`);
	}

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
	const supabase = await createClient();
	const { data, error } = await supabase
		.from("overhead_settings")
		.select("contingency_percent")
		.eq("id", 1)
		.maybeSingle();

	if (error) {
		throw new Error(`Failed to load contingency: ${error.message}`);
	}

	return Number(data?.contingency_percent ?? 5);
}
