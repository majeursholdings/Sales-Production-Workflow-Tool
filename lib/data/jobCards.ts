import { qtyLabel, type PartDemand } from "@/lib/inventory";
import {
	STEP_NAMES,
	type DeliveryState,
	type FurnitureKind,
	type JobCard,
	type MachineUse,
	type Part,
	type PartOption,
	type PartStatus,
	type QuoteOption,
	type StepStatus,
	type WorkshopPerson,
} from "@/lib/jobCards";
import { createClient } from "@/utils/supabase/server";

const JOB_CARD_COLUMNS = `number, quote_number, client_name, items_summary, icon, due, address,
	delivery_state, delivery_note, delivery_booked_for, delivery_photo_urls, note, rejected_note, closed,
	job_card_items(name, kind, spec, qty, sort_order),
	job_card_parts(sku, qty, reserved, picked, parts(name, spec, unit)),
	job_card_steps(step_index, status, planned_hours, job_card_step_machines(machine_id, hours, machines(name))),
	job_card_time_entries(id, step_index, who, worked_on, hours, redo_note, created_at, job_card_time_entry_machines(machine_id, hours, machines(name))),
	job_card_redos(id, step_index, reason, hours, found_at, happened_on, photo_urls, created_at)`;

type MachineHoursRow = {
	machine_id: string;
	hours: number | string;
	machines: { name: string } | null;
};

type JobCardRow = {
	number: string;
	quote_number: string;
	client_name: string;
	items_summary: string;
	icon: FurnitureKind;
	due: string;
	address: string;
	delivery_state: DeliveryState;
	delivery_note: string;
	delivery_booked_for: string | null;
	delivery_photo_urls: string[] | null;
	note: string;
	rejected_note: string | null;
	closed: boolean;
	job_card_items: {
		name: string;
		kind: FurnitureKind;
		spec: string;
		qty: number;
		sort_order: number;
	}[];
	job_card_parts: {
		sku: string;
		qty: number | string;
		reserved: number | string;
		picked: boolean;
		parts: { name: string; spec: string; unit: string } | null;
	}[];
	job_card_steps: {
		step_index: number;
		status: StepStatus;
		planned_hours: number | string;
		job_card_step_machines: MachineHoursRow[];
	}[];
	job_card_time_entries: {
		id: string;
		step_index: number;
		who: string;
		worked_on: string;
		hours: number | string;
		redo_note: string | null;
		created_at: string;
		job_card_time_entry_machines: MachineHoursRow[];
	}[];
	job_card_redos: {
		id: string;
		step_index: number;
		reason: string;
		hours: number | string;
		found_at: string;
		happened_on: string;
		photo_urls: string[] | null;
		created_at: string;
	}[];
};

const toMachineUse = (m: MachineHoursRow): MachineUse => ({
	machineId: m.machine_id,
	machine: m.machines?.name ?? m.machine_id,
	hours: Number(m.hours),
});

const byDateThenCreated =
	<T extends { created_at: string }>(date: (row: T) => string) =>
	(a: T, b: T) =>
		date(a).localeCompare(date(b)) || a.created_at.localeCompare(b.created_at);

/** Open purchase orders raised for a job card, as "JC-…|sku", so short parts can show "On order". */
async function partsOnOrder(numbers: string[]): Promise<Set<string>> {
	if (numbers.length === 0) return new Set();
	const supabase = await createClient();
	// Readers without purchase order access just get nothing back, and see "Short"
	const { data } = await supabase
		.from("purchase_orders")
		.select("job_card, purchase_order_lines(sku, ordered, received)")
		.in("job_card", numbers)
		.in("status", ["draft", "approval", "sent", "part"]);
	const onOrder = new Set<string>();
	for (const po of data ?? []) {
		const lines = (po.purchase_order_lines ?? []) as {
			sku: string;
			ordered: number | string;
			received: number | string;
		}[];
		for (const line of lines)
			if (Number(line.received) < Number(line.ordered))
				onOrder.add(`${po.job_card}|${line.sku}`);
	}
	return onOrder;
}

function partStatus(row: JobCardRow["job_card_parts"][number], onOrder: boolean): PartStatus {
	if (row.picked) return "Picked";
	if (Number(row.reserved) >= Number(row.qty)) return "Reserved";
	return onOrder ? "On order" : "Short";
}

/** "Walnut slab and paper cord": the short parts, in words. */
const listWords = (names: string[]) =>
	names.length <= 1
		? (names[0] ?? "")
		: `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

function toJobCard(row: JobCardRow, onOrder: Set<string>): JobCard {
	const steps = STEP_NAMES.map((_, index) => {
		const step = row.job_card_steps.find((s) => s.step_index === index);
		return {
			status: step?.status ?? "todo",
			plannedHours: Number(step?.planned_hours ?? 0),
			plannedMachines: (step?.job_card_step_machines ?? []).map(toMachineUse),
			entries: row.job_card_time_entries
				.filter((e) => e.step_index === index)
				.sort(byDateThenCreated((e) => e.worked_on))
				.map((e) => ({
					id: e.id,
					who: e.who,
					date: e.worked_on,
					hours: Number(e.hours),
					machines: e.job_card_time_entry_machines.map(toMachineUse),
					redoNote: e.redo_note ?? undefined,
				})),
			redos: row.job_card_redos
				.filter((r) => r.step_index === index)
				.sort(byDateThenCreated((r) => r.happened_on))
				.map((r) => ({
					id: r.id,
					reason: r.reason,
					hours: Number(r.hours),
					foundAt: r.found_at,
					date: r.happened_on,
					photos: r.photo_urls ?? [],
				})),
		};
	});

	const parts: Part[] = row.job_card_parts
		.map((p) => ({
			sku: p.sku,
			name: p.parts?.name ?? p.sku,
			spec: p.parts?.spec ?? "",
			qty: qtyLabel(Number(p.qty), p.parts?.unit ?? "unit"),
			status: partStatus(p, onOrder.has(`${row.number}|${p.sku}`)),
		}))
		.sort((a, b) => a.name.localeCompare(b.name));

	const short = parts.filter((p) => p.status === "Short" || p.status === "On order");
	const blocked = steps.some((s) => s.status === "blocked");

	return {
		id: row.number,
		client: row.client_name,
		quote: row.quote_number,
		items: row.items_summary,
		icon: row.icon,
		due: row.due,
		address: row.address,
		delivery: {
			state: row.delivery_state,
			note: row.delivery_note,
			bookedFor: row.delivery_booked_for ?? undefined,
		},
		note: row.note,
		build: [...row.job_card_items]
			.sort((a, b) => a.sort_order - b.sort_order)
			.map((i) => ({ name: i.name, kind: i.kind, spec: i.spec, qty: i.qty })),
		parts,
		steps,
		blockedNote:
			blocked && short.length
				? `Waiting on ${listWords(short.map((p) => p.name.toLowerCase()))} from procurement before cutting can start.`
				: undefined,
		rejectedNote: row.rejected_note ?? undefined,
		deliveryPhotos: row.delivery_photo_urls ?? [],
		closed: row.closed,
	};
}

export async function getJobCards(): Promise<JobCard[]> {
	const supabase = await createClient();
	const { data, error } = await supabase
		.from("job_cards")
		.select(JOB_CARD_COLUMNS)
		.order("closed", { ascending: true })
		.order("due", { ascending: true });
	if (error) throw new Error(`Failed to load job cards: ${error.message}`);
	const rows = (data ?? []) as unknown as JobCardRow[];
	const onOrder = await partsOnOrder(rows.filter((r) => !r.closed).map((r) => r.number));
	return rows.map((row) => toJobCard(row, onOrder));
}

/** One job card by its number, or null when there isn't one (so the page can 404). */
export async function getJobCard(number: string): Promise<JobCard | null> {
	const supabase = await createClient();
	const { data, error } = await supabase
		.from("job_cards")
		.select(JOB_CARD_COLUMNS)
		.eq("number", number)
		.maybeSingle();
	if (error) throw new Error(`Failed to load job card: ${error.message}`);
	if (!data) return null;
	const row = data as unknown as JobCardRow;
	return toJobCard(row, row.closed ? new Set() : await partsOnOrder([row.number]));
}

/** Active Production staff who can log time on a job card. */
export async function getWorkshopPeople(): Promise<WorkshopPerson[]> {
	const supabase = await createClient();
	const { data, error } = await supabase.rpc("workshop_people");
	if (error) throw new Error(`Failed to load the workshop team: ${error.message}`);
	return ((data ?? []) as { id: string; full_name: string }[]).map((p) => ({
		id: p.id,
		name: p.full_name,
	}));
}

/** What open job cards still need of each part beyond what's reserved for them, for Inventory. */
export async function getPartDemand(): Promise<PartDemand[]> {
	const supabase = await createClient();
	const { data, error } = await supabase
		.from("job_card_parts")
		.select("sku, qty, reserved, job_cards!inner(number, client_name, closed)")
		.eq("picked", false)
		.eq("job_cards.closed", false);
	// Readers without job card access just see no demand
	if (error) return [];
	return (
		(data ?? []) as unknown as {
			sku: string;
			qty: number | string;
			reserved: number | string;
			job_cards: { number: string; client_name: string };
		}[]
	)
		.map((p) => ({
			sku: p.sku,
			jobCard: p.job_cards.number,
			client: p.job_cards.client_name,
			qty: Number(p.qty) - Number(p.reserved),
		}))
		.filter((d) => d.qty > 0);
}

/** Quotes with their deposit paid and no job card yet, with the items on their current version. */
export async function getQuotesWithoutJobCard(): Promise<QuoteOption[]> {
	const supabase = await createClient();
	const [quotesRes, cardsRes] = await Promise.all([
		supabase
			.from("quotes")
			.select(
				"id, quote_number, client_id, client_name, current_version, quote_versions(version_number, quote_lines(name, description, quantity, sort_order))",
			)
			.eq("status", "paid")
			.order("created_at", { ascending: false }),
		supabase.from("job_cards").select("quote_id").not("quote_id", "is", null),
	]);
	if (quotesRes.error) throw new Error(`Failed to load quotes: ${quotesRes.error.message}`);
	if (cardsRes.error) throw new Error(`Failed to load job cards: ${cardsRes.error.message}`);
	const taken = new Set((cardsRes.data ?? []).map((c) => c.quote_id as string));

	type QuoteRow = {
		id: string;
		quote_number: string;
		client_id: string | null;
		client_name: string;
		current_version: number;
		quote_versions: {
			version_number: number;
			quote_lines: {
				name: string;
				description: string;
				quantity: number | string;
				sort_order: number;
			}[];
		}[];
	};
	const quotes = ((quotesRes.data ?? []) as unknown as QuoteRow[]).filter(
		(q) => !taken.has(q.id),
	);

	// Production can't read clients; they then type the address in
	const clientIds = [
		...new Set(quotes.map((q) => q.client_id).filter((id): id is string => !!id)),
	];
	const locations = new Map<string, string>();
	if (clientIds.length) {
		const { data } = await supabase.from("clients").select("id, location").in("id", clientIds);
		for (const c of data ?? []) locations.set(c.id as string, (c.location as string) ?? "");
	}

	return quotes.map((q) => {
		const version = q.quote_versions.find((v) => v.version_number === q.current_version);
		return {
			id: q.id,
			number: q.quote_number,
			clientId: q.client_id,
			client: q.client_name,
			address: q.client_id ? (locations.get(q.client_id) ?? "") : "",
			items: [...(version?.quote_lines ?? [])]
				.sort((a, b) => a.sort_order - b.sort_order)
				.map((l) => ({
					name: l.name,
					spec: l.description,
					qty: Math.max(1, Math.round(Number(l.quantity))),
				})),
		};
	});
}

/** Parts in stock, for a job card's picking list. */
export async function getPartOptions(): Promise<PartOption[]> {
	const supabase = await createClient();
	const { data, error } = await supabase
		.from("parts")
		.select("sku, name, unit, in_stock, reserved")
		.eq("is_archived", false)
		.order("name", { ascending: true });
	if (error) throw new Error(`Failed to load parts: ${error.message}`);
	return (data ?? []).map((p) => ({
		sku: p.sku as string,
		name: p.name as string,
		unit: p.unit as string,
		available: Number(p.in_stock) - Number(p.reserved),
	}));
}
