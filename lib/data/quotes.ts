import dayjs from "dayjs";
import type { OverviewItem } from "@/components/common/overViewCard";
import { formatNaira } from "@/lib/currency";
import {
	VAT_RATE,
	type Quote,
	type QuoteContact,
	type QuoteDetail,
	type QuoteLine,
	type QuoteStatus,
	type QuoteVersion,
} from "@/lib/quotes";
import { createClient } from "@/utils/supabase/server";

const NO_CONTACT: QuoteContact = { email: "", whatsapp: "", phone: "", phoneLabel: "" };

function formatVersionLabel(currentVersion: number): string {
	if (currentVersion <= 1) return "v1";
	const earlier = currentVersion - 1;
	return `v${currentVersion} · ${earlier} earlier ${earlier === 1 ? "version" : "versions"}`;
}

function buildContact(
	client: {
		phone: string | null;
		phone_key: string | null;
		email: string | null;
	} | null,
): QuoteContact {
	if (!client) return NO_CONTACT;
	const phoneLabel = client.phone?.trim() ?? "";
	const digits = (client.phone_key ?? phoneLabel).replace(/\D/g, "");
	const phone = client.phone_key ?? (digits ? `+${digits}` : "");
	return {
		email: client.email?.trim() ?? "",
		whatsapp: digits,
		phone,
		phoneLabel,
	};
}

export async function getQuotes(): Promise<Quote[]> {
	const supabase = await createClient();
	const { data, error } = await supabase
		.from("quotes")
		.select(
			"quote_number, client_name, items_summary, total_ngn, status, created_by_name, valid_until, current_version",
		)
		.order("created_at", { ascending: false });

	if (error) {
		throw new Error(`Failed to load quotes: ${error.message}`);
	}

	return (data ?? []).map((row) => ({
		id: row.quote_number,
		client: row.client_name,
		items: row.items_summary ?? "",
		total: Number(row.total_ngn),
		status: row.status as QuoteStatus,
		createdBy: row.created_by_name || "Staff",
		validUntil: row.valid_until,
		validUntilLabel: dayjs(row.valid_until).format("D MMM YYYY"),
		version: formatVersionLabel(Number(row.current_version ?? 1)),
	}));
}

export async function getQuotesOverview(): Promise<OverviewItem[]> {
	const supabase = await createClient();
	const { data, error } = await supabase.from("quotes").select("status, total_ngn, deposit_rate");

	if (error) {
		throw new Error(`Failed to load quotes overview: ${error.message}`);
	}

	const rows = data ?? [];
	const openQuotes = rows.filter(
		(r) => r.status === "draft" || r.status === "sent" || r.status === "expiring",
	);
	const sentOrExpiring = rows.filter((r) => r.status === "sent" || r.status === "expiring");
	const paidQuotes = rows.filter((r) => r.status === "paid");
	const expiringQuotes = rows.filter((r) => r.status === "expiring");

	const openTotal = openQuotes.reduce((sum, r) => sum + Number(r.total_ngn), 0);
	const depositsDue = sentOrExpiring.reduce(
		(sum, r) => sum + Number(r.total_ngn) * Number(r.deposit_rate ?? 0.7),
		0,
	);
	const depositsRecorded = paidQuotes.reduce(
		(sum, r) => sum + Number(r.total_ngn) * Number(r.deposit_rate ?? 0.7),
		0,
	);

	return [
		{
			label: "Open quotes",
			value: formatNaira(openTotal),
			note: `${openQuotes.length} ${openQuotes.length === 1 ? "quote" : "quotes"} in Draft, Sent or Expiring soon`,
		},
		{
			label: "Deposits due",
			value: formatNaira(depositsDue),
			note: "On sent quotes, not yet paid",
		},
		{
			label: "Deposits recorded",
			value: formatNaira(depositsRecorded),
			note: `${paidQuotes.length} ${paidQuotes.length === 1 ? "order" : "orders"} now in production`,
		},
		{
			label: "Expiring soon",
			value: String(expiringQuotes.length),
			note:
				expiringQuotes.length > 0
					? "Follow up before they lapse"
					: "None expiring right now",
			tone: expiringQuotes.length > 0 ? "warning" : undefined,
		},
	];
}

export async function getQuoteDetail(quoteNumber: string): Promise<QuoteDetail | null> {
	const supabase = await createClient();

	const { data: quoteRow, error: quoteError } = await supabase
		.from("quotes")
		.select(
			"id, quote_number, client_id, client_name, items_summary, status, vat_rate, deposit_rate, total_ngn, current_version, valid_until, sent_at, created_by_name",
		)
		.eq("quote_number", quoteNumber)
		.maybeSingle();

	if (quoteError) {
		throw new Error(`Failed to load quote ${quoteNumber}: ${quoteError.message}`);
	}
	if (!quoteRow) return null;

	const [{ data: clientRow }, { data: versionRows }, { data: activityRows }] = await Promise.all([
		quoteRow.client_id
			? supabase
					.from("clients")
					.select("phone, phone_key, email")
					.eq("id", quoteRow.client_id)
					.maybeSingle()
			: Promise.resolve({ data: null }),
		supabase
			.from("quote_versions")
			.select(
				"id, version_number, sent_line, change_note, changes, quote_lines (name, description, quantity, unit_price, sort_order)",
			)
			.eq("quote_id", quoteRow.id)
			.order("version_number", { ascending: false }),
		supabase
			.from("quote_activity")
			.select("when_label, what, detail")
			.eq("quote_id", quoteRow.id)
			.order("created_at", { ascending: true }),
	]);

	const validUntilLabel = dayjs(quoteRow.valid_until).format("D MMM YYYY");
	const quote: Quote = {
		id: quoteRow.quote_number,
		client: quoteRow.client_name,
		items: quoteRow.items_summary ?? "",
		total: Number(quoteRow.total_ngn),
		status: quoteRow.status as QuoteStatus,
		createdBy: quoteRow.created_by_name || "Staff",
		validUntil: quoteRow.valid_until,
		validUntilLabel,
		version: formatVersionLabel(Number(quoteRow.current_version ?? 1)),
	};

	const versions: QuoteVersion[] = (versionRows ?? []).map((v) => {
		const rawLines = Array.isArray(v.quote_lines) ? v.quote_lines : [];
		const sortedLines: QuoteLine[] = [...rawLines]
			.sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))
			.map((l) => ({
				name: l.name,
				desc: l.description ?? "",
				qty: Number(l.quantity),
				unit: Number(l.unit_price),
			}));

		return {
			n: Number(v.version_number),
			sentLine: v.sent_line || `By ${quote.createdBy}`,
			lines: sortedLines,
			changeNote: v.change_note ?? undefined,
			changes: Array.isArray(v.changes) ? (v.changes as QuoteVersion["changes"]) : undefined,
		};
	});

	if (versions.length === 0) {
		const vatRate = Number(quoteRow.vat_rate ?? VAT_RATE);
		versions.push({
			n: Number(quoteRow.current_version ?? 1),
			sentLine: `By ${quote.createdBy}`,
			lines: [
				{
					name: quote.items || "Quote items",
					desc: "Line items not recorded yet.",
					qty: 1,
					unit: quote.total / (1 + vatRate),
				},
			],
		});
	}

	const sentPrefix = quoteRow.sent_at
		? `Sent ${dayjs(quoteRow.sent_at).format("D MMM YYYY")}`
		: quote.status === "draft"
			? "Draft"
			: "Sent";

	return {
		quote,
		contact: buildContact(clientRow),
		versions,
		activity: (activityRows ?? []).map((a) => ({
			when: a.when_label,
			what: a.what,
			detail: a.detail ?? "",
		})),
		depositRate: Number(quoteRow.deposit_rate ?? 0.7),
		validityLine: `${sentPrefix} · Valid until ${validUntilLabel}`,
	};
}
