import dayjs from "dayjs";
import type { BadgeVariant } from "@/components/common/badge";
import type { OverviewItem } from "@/components/common/overViewCard";
import { wholeNaira } from "@/lib/quoteBuilder";

export type MachineCondition = "working" | "out_of_service";

/** What the machine's condition looks like today: "overdue" is a working machine past its service date. */
export type MachineStatus = "working" | "overdue" | "out_of_service";

export const MACHINE_STATUS: Record<MachineStatus, { label: string; tone: BadgeVariant }> = {
	working: { label: "Working", tone: "success" },
	overdue: { label: "Service overdue", tone: "warning" },
	out_of_service: { label: "Out of service", tone: "danger" },
};

export const MAINTENANCE_TYPES = [
	"Servicing",
	"Oil change",
	"Rubber change",
	"Parts change",
	"Repair",
	"Inspection",
	"Other",
] as const;
export type MaintenanceType = (typeof MAINTENANCE_TYPES)[number];

/** Which icon stands in for the machine's photo until photo upload is connected. */
export type MachineIcon = "saw" | "planer" | "cnc" | "sewing" | "compressor" | "spray" | "edge";

/** The icon a machine gets from its name, e.g. "Band saw" → saw. */
export function iconFor(name: string): MachineIcon {
	const n = name.toLowerCase();
	if (/plane|thickness|jointer/.test(n)) return "planer";
	if (/saw/.test(n)) return "saw";
	if (/sew|stitch/.test(n)) return "sewing";
	if (/compress|staple|nail/.test(n)) return "compressor";
	if (/spray|paint|booth/.test(n)) return "spray";
	if (/edge|band(er|ing)/.test(n)) return "edge";
	return "cnc";
}

/** A URL-safe id from a machine's name, e.g. "Table saw" → table-saw. */
export const slugOf = (name: string) =>
	name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");

/** A working machine, for picking machine time on a job card. */
export type MachineOption = { id: string; name: string };

export type MaintenanceRecord = {
	id: string;
	/** ISO date, YYYY-MM-DD. */
	date: string;
	type: MaintenanceType;
	notes: string;
	/** Who did the work: a staff member or a service company. */
	doneBy: string;
	loggedBy: string;
	/** Parts and labour in naira. 0 when it cost nothing. */
	cost: number;
	photoCount: number;
	photos: string[];
};

export type Machine = {
	id: string;
	name: string;
	serialNumber: string;
	location: string;
	/** When it was bought, as the workshop says it, e.g. "Mar 2021". */
	bought: string;
	/** What an hour of machine time costs on a quote, in naira. Hidden from Production. */
	hourlyCost: number;
	serviceEveryMonths: number;
	/** What it has been used to build, from job cards, in words. */
	usedIn: string;
	notes: string;
	condition: MachineCondition;
	/** ISO date of the next service. Null while it's out of service and waiting on a repair. */
	nextService: string | null;
	hoursTotal: number;
	hoursMonth: number;
	/** The latest job card time logged on it, or null when it hasn't been used yet. */
	lastUsed: { when: string; job: string } | null;
	icon: MachineIcon;
	photoUrl?: string;
	/** Newest first. */
	history: MaintenanceRecord[];
};

export const everyLabel = (months: number) => (months === 1 ? "month" : `${months} months`);
export const dateLabel = (iso: string) => dayjs(iso).format("D MMM YYYY");

export function statusOf(machine: Machine, today: string): MachineStatus {
	if (machine.condition === "out_of_service") return "out_of_service";
	if (machine.nextService && machine.nextService < today) return "overdue";
	return "working";
}

export const maintenanceTotal = (m: Machine) => m.history.reduce((sum, r) => sum + r.cost, 0);

const yearOf = (iso: string) => dayjs(iso).year();

/** Newest record first, so the table, "last maintenance" and the totals all agree. */
export const sortHistory = (history: MaintenanceRecord[]) =>
	[...history].sort((a, b) => b.date.localeCompare(a.date));

// ─── Overview figures ────────────────────────────────────────────────────────

const names = (list: Machine[]) => list.map((m) => m.name.toLowerCase());

export function buildMachinesOverview(machines: Machine[], today: string): OverviewItem[] {
	const year = yearOf(today);
	const count = (s: MachineStatus) => machines.filter((m) => statusOf(m, today) === s).length;
	const records = machines.flatMap((m) => m.history.map((r) => ({ machine: m, record: r })));
	const thisYear = records.filter(({ record }) => yearOf(record.date) === year);
	const busiest = [...machines].sort((a, b) => b.hoursMonth - a.hoursMonth)[0];
	const costliest = machines
		.map((m) => ({
			name: m.name,
			spent: m.history.filter((r) => yearOf(r.date) === year).reduce((s, r) => s + r.cost, 0),
		}))
		.sort((a, b) => b.spent - a.spent)[0];
	const horizon = dayjs(today).add(30, "day").format("YYYY-MM-DD");
	const soon = machines.filter(
		(m) => statusOf(m, today) === "overdue" || (m.nextService && m.nextService <= horizon),
	);
	// An out-of-service machine waits on a repair, not a service date
	const dueSoon = soon.filter((m) => m.condition === "working");

	return [
		{
			label: "Machines",
			value: String(machines.length),
			note: `${count("working")} working, ${count("overdue")} overdue, ${count("out_of_service")} out of service`,
		},
		{
			label: "Hours used this month",
			value: `${machines.reduce((sum, m) => sum + m.hoursMonth, 0).toLocaleString("en-NG")} h`,
			note: busiest?.hoursMonth
				? `From job cards · busiest: ${busiest.name.toLowerCase()} (${busiest.hoursMonth} h)`
				: "From job cards",
		},
		{
			label: "Maintenance spent this year",
			value: wholeNaira(thisYear.reduce((sum, { record }) => sum + record.cost, 0)),
			note: `${thisYear.length} ${thisYear.length === 1 ? "job" : "jobs"} logged${costliest && costliest.spent > 0 ? ` · most: ${costliest.name.toLowerCase()}` : ""}`,
		},
		{
			label: "Service due in the next 30 days",
			value: String(dueSoon.length),
			note: dueSoon.length ? names(dueSoon).slice(0, 3).join(", ") : "Nothing due",
			tone: dueSoon.length ? "warning" : undefined,
		},
	];
}

export function buildMachineOverview(machine: Machine, today: string): OverviewItem[] {
	const total = maintenanceTotal(machine);
	const year = yearOf(today);
	const thisYear = machine.history
		.filter((r) => yearOf(r.date) === year)
		.reduce((sum, r) => sum + r.cost, 0);
	const jobs = machine.history.length;
	const perHour =
		machine.hoursTotal > 0 ? ` · ${wholeNaira(total / machine.hoursTotal)} per hour used` : "";
	const status = statusOf(machine, today);

	return [
		{
			label: "Hours used so far",
			value: `${machine.hoursTotal.toLocaleString("en-NG")} h`,
			note: `From job cards${machine.bought ? ` since ${machine.bought}` : ""} · ${machine.hoursMonth} h this month`,
		},
		machine.lastUsed
			? { label: "Last used", value: machine.lastUsed.when, note: machine.lastUsed.job }
			: { label: "Last used", value: "Not used yet", note: "No machine time logged" },
		{
			label: "Maintenance cost so far",
			value: wholeNaira(total),
			note: `${jobs} ${jobs === 1 ? "job" : "jobs"} logged · ${wholeNaira(thisYear)} this year${perHour}`,
		},
		{
			label: "Next service",
			value: machine.nextService ? dateLabel(machine.nextService) : "When repaired",
			note: `Every ${everyLabel(machine.serviceEveryMonths)}`,
			tone: status === "overdue" ? "warning" : undefined,
		},
	];
}
