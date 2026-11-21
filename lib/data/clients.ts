import { normalizeNigerianPhone } from "@/components/forms/form.validators";
import type { Client, ClientType } from "@/lib/clients";
import { createClient } from "@/utils/supabase/server";

export async function getClients(): Promise<Client[]> {
	const supabase = await createClient();
	const { data, error } = await supabase
		.from("clients")
		.select(
			"id, name, phone, phone_key, email, client_type, company, location, source, quotes_count, total_spent, last_activity_label, trade_tier",
		)
		.order("last_activity_at", { ascending: false });

	if (error) {
		throw new Error(`Failed to load clients: ${error.message}`);
	}

	return (data ?? []).map((row) => {
		const phone = row.phone ?? "";
		const email = row.email ?? "";
		return {
			id: row.id,
			name: row.name,
			contact: [phone, email].filter(Boolean).join(" · "),
			phoneKey: row.phone_key ?? normalizeNigerianPhone(phone),
			email,
			type: row.client_type as ClientType,
			company: row.company ?? "",
			location: row.location ?? "",
			source: row.source ?? "",
			quotes: Number(row.quotes_count ?? 0),
			spent: Number(row.total_spent ?? 0),
			last: row.last_activity_label ?? "No quotes yet",
			tier: row.trade_tier ?? "",
		};
	});
}
