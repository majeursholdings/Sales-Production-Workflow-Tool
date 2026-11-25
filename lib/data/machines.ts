import dayjs from "dayjs";
import {
	iconFor,
	sortHistory,
	type Machine,
	type MachineCondition,
	type MachineOption,
	type MaintenanceRecord,
	type MaintenanceType,
} from "@/lib/machines";
import { createClient } from "@/utils/supabase/server";

const MACHINE_COLUMNS =
	"id, name, serial_number, location, bought, hourly_cost, service_every_months, notes, condition, next_service, machine_maintenance(id, done_on, type, notes, done_by, logged_by, cost, photo_count)";

type MachineRow = {
	id: string;
	name: string;
	serial_number: string;
	location: string;
	bought: string;
	hourly_cost: number | string;
	service_every_months: number;
	notes: string;
	condition: MachineCondition;
	next_service: string | null;
	machine_maintenance: {
		id: string;
		done_on: string;
		type: MaintenanceType;
		notes: string;
		done_by: string;
		logged_by: string;
		cost: number | string;
		photo_count: number;
	}[];
};

type UsageRow = {
	machine_id: string;
	hours: number | string;
	job_card_time_entries: {
		worked_on: string;
		created_at: string;
		job_card: string;
		job_cards: { items_summary: string; job_card_items: { name: string }[] } | null;
	} | null;
};

type Usage = {
	hoursTotal: number;
	hoursMonth: number;
	last: { date: string; createdAt: string; job: string } | null;
	items: Set<string>;
};

function whenLabel(date: string, createdAt: string) {
	const today = dayjs().format("YYYY-MM-DD");
	if (date === today) {
		// Logged the same day it was worked: the time it was logged says when
		return dayjs(createdAt).format("YYYY-MM-DD") === today
			? `Today, ${dayjs(createdAt).format("HH:mm")}`
			: "Today";
	}
	if (date === dayjs().subtract(1, "day").format("YYYY-MM-DD")) return "Yesterday";
	return dayjs(date).format("D MMM YYYY");
}

/** "3-seater sofa, coffee table and 9 more", from what the machine's job cards built. */
function usedInLabel(items: Set<string>) {
	const list = [...items];
	if (list.length === 0) return "Not used yet";
	const shown = list.slice(0, 2).map((name, i) => (i === 0 ? name : name.toLowerCase()));
	const more = list.length - shown.length;
	return more > 0 ? `${shown.join(", ")} and ${more} more` : shown.join(" and ");
}

/** Machine time logged on job cards, per machine (or for one machine). */
async function loadUsage(machineId?: string): Promise<Map<string, Usage>> {
	const supabase = await createClient();
	let query = supabase
		.from("job_card_time_entry_machines")
		.select(
			"machine_id, hours, job_card_time_entries(worked_on, created_at, job_card, job_cards(items_summary, job_card_items(name)))",
		);
	if (machineId) query = query.eq("machine_id", machineId);
	const { data, error } = await query;
	if (error) throw new Error(`Failed to load machine usage: ${error.message}`);

	const month = dayjs().format("YYYY-MM");
	const usage = new Map<string, Usage>();
	for (const row of (data ?? []) as unknown as UsageRow[]) {
		const entry = row.job_card_time_entries;
		if (!entry) continue;
		const hours = Number(row.hours);
		const u = usage.get(row.machine_id) ?? {
			hoursTotal: 0,
			hoursMonth: 0,
			last: null,
			items: new Set<string>(),
		};
		u.hoursTotal += hours;
		if (entry.worked_on.startsWith(month)) u.hoursMonth += hours;
		const newer =
			!u.last ||
			entry.worked_on > u.last.date ||
			(entry.worked_on === u.last.date && entry.created_at > u.last.createdAt);
		if (newer) {
			u.last = {
				date: entry.worked_on,
				createdAt: entry.created_at,
				job: `${entry.job_card} · ${entry.job_cards?.items_summary || "Job card"}`,
			};
		}
		for (const item of entry.job_cards?.job_card_items ?? []) u.items.add(item.name);
		usage.set(row.machine_id, u);
	}
	return usage;
}

const toRecord = (r: MachineRow["machine_maintenance"][number]): MaintenanceRecord => ({
	id: r.id,
	date: r.done_on,
	type: r.type,
	notes: r.notes,
	doneBy: r.done_by,
	loggedBy: r.logged_by,
	cost: Number(r.cost),
	photoCount: r.photo_count,
});

function toMachine(row: MachineRow, usage: Usage | undefined): Machine {
	return {
		id: row.id,
		name: row.name,
		serialNumber: row.serial_number,
		location: row.location,
		bought: row.bought,
		hourlyCost: Number(row.hourly_cost),
		serviceEveryMonths: row.service_every_months,
		usedIn: usedInLabel(usage?.items ?? new Set()),
		notes: row.notes,
		condition: row.condition,
		nextService: row.next_service,
		hoursTotal: Math.round((usage?.hoursTotal ?? 0) * 10) / 10,
		hoursMonth: Math.round((usage?.hoursMonth ?? 0) * 10) / 10,
		lastUsed: usage?.last
			? { when: whenLabel(usage.last.date, usage.last.createdAt), job: usage.last.job }
			: null,
		icon: iconFor(row.name),
		history: sortHistory(row.machine_maintenance.map(toRecord)),
	};
}

export async function getMachines(): Promise<Machine[]> {
	const supabase = await createClient();
	const [{ data, error }, usage] = await Promise.all([
		supabase
			.from("machines")
			.select(MACHINE_COLUMNS)
			.eq("is_archived", false)
			.order("name", { ascending: true }),
		loadUsage(),
	]);
	if (error) throw new Error(`Failed to load machines: ${error.message}`);
	return ((data ?? []) as unknown as MachineRow[]).map((row) =>
		toMachine(row, usage.get(row.id)),
	);
}

/** One machine by its URL id, or null when there isn't one (so the page can 404). */
export async function getMachine(id: string): Promise<Machine | null> {
	const supabase = await createClient();
	const [{ data, error }, usage] = await Promise.all([
		supabase
			.from("machines")
			.select(MACHINE_COLUMNS)
			.eq("id", id)
			.eq("is_archived", false)
			.maybeSingle(),
		loadUsage(id),
	]);
	if (error) throw new Error(`Failed to load machine: ${error.message}`);
	return data ? toMachine(data as unknown as MachineRow, usage.get(id)) : null;
}

/** Machines in service, for logging machine time on a job card. */
export async function getWorkingMachines(): Promise<MachineOption[]> {
	const supabase = await createClient();
	const { data, error } = await supabase
		.from("machines")
		.select("id, name")
		.eq("is_archived", false)
		.eq("condition", "working")
		.order("name", { ascending: true });
	if (error) throw new Error(`Failed to load machines: ${error.message}`);
	return (data ?? []).map((m) => ({ id: m.id as string, name: m.name as string }));
}
