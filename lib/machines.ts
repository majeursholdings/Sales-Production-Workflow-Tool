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
	/** Furniture types that use it, in words. */
	usedIn: string;
	notes: string;
	condition: MachineCondition;
	/** ISO date of the next service. Null while it's out of service and waiting on a repair. */
	nextService: string | null;
	hoursTotal: number;
	hoursMonth: number;
	lastUsed: { when: string; job: string };
	icon: MachineIcon;
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
			note: busiest
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
			note: `From job cards since ${machine.bought} · ${machine.hoursMonth} h this month`,
		},
		{ label: "Last used", value: machine.lastUsed.when, note: machine.lastUsed.job },
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

// ─── Sample data ─────────────────────────────────────────────────────────────
// TODO: replace with real machines once there's a backend. The sample machines
// from the design (all illustrative). The pages only read machines through
// getMachines / getMachine, so swapping in real data is a one-file change.

const rec = (
	date: string,
	type: MaintenanceType,
	notes: string,
	doneBy: string,
	loggedBy: string,
	cost: number,
	photoCount = 0,
): MaintenanceRecord => ({
	id: `${date}-${type}`.toLowerCase().replace(/\s+/g, "-"),
	date,
	type,
	notes,
	doneBy,
	loggedBy,
	cost,
	photoCount,
});

const TOBI = "Tobi Adekunle";
const IFEANYI = "Ifeanyi Nwosu";
const IBRAHIM = "Ibrahim Musa";

const MACHINES: Machine[] = [
	{
		id: "table-saw",
		name: "Table saw",
		serialNumber: "TS-2021-0448",
		location: "Cutting bay",
		bought: "Mar 2021",
		hourlyCost: 3500,
		serviceEveryMonths: 3,
		usedIn: "3-seater sofa, coffee table and 9 more",
		notes: "",
		condition: "working",
		nextService: "2027-01-15",
		hoursTotal: 3120,
		hoursMonth: 58,
		lastUsed: { when: "Today, 11:40", job: "JC-20261117-0034 · 3-seater sofa" },
		icon: "saw",
		history: [
			rec(
				"2026-11-12",
				"Parts change",
				"Replaced riving knife and 40-tooth blade.",
				IBRAHIM,
				TOBI,
				38000,
				2,
			),
			rec(
				"2026-10-15",
				"Servicing",
				"Cleaned, aligned the fence, checked motor brushes.",
				"Lagos Machine Services",
				IFEANYI,
				25000,
			),
			rec("2026-08-02", "Rubber change", "Replaced drive belt rubber.", IBRAHIM, TOBI, 6500),
		],
	},
	{
		id: "planer-thicknesser",
		name: "Planer and thicknesser",
		serialNumber: "PT-2022-1173",
		location: "Cutting bay",
		bought: "Jan 2022",
		hourlyCost: 2800,
		serviceEveryMonths: 3,
		usedIn: "11 types",
		notes: "",
		condition: "working",
		nextService: "2026-12-20",
		hoursTotal: 2410,
		hoursMonth: 34,
		lastUsed: { when: "Today, 09:15", job: "JC-20261117-0034 · 3-seater sofa" },
		icon: "planer",
		history: [
			rec(
				"2026-09-20",
				"Parts change",
				"Sharpened and refitted the three knives.",
				IBRAHIM,
				TOBI,
				15000,
			),
			rec(
				"2026-06-20",
				"Servicing",
				"Full service, new bed rollers.",
				"Lagos Machine Services",
				IFEANYI,
				30000,
			),
		],
	},
	{
		id: "cnc-router",
		name: "CNC router",
		serialNumber: "CNC-2024-0019",
		location: "Machine room",
		bought: "Feb 2024",
		hourlyCost: 12000,
		serviceEveryMonths: 1,
		usedIn: "Coffee table, side table, desk",
		notes: "Book a day ahead; shared with sample work.",
		condition: "working",
		nextService: "2026-12-01",
		hoursTotal: 1286,
		hoursMonth: 22,
		lastUsed: { when: "Yesterday", job: "JC-20261116-0033 · Coffee table" },
		icon: "cnc",
		history: [
			rec(
				"2026-11-01",
				"Oil change",
				"Lubricated rails and ball screws.",
				IBRAHIM,
				TOBI,
				8000,
			),
			rec(
				"2026-10-01",
				"Oil change",
				"Lubricated rails and ball screws.",
				IBRAHIM,
				TOBI,
				8000,
			),
			rec(
				"2026-08-14",
				"Repair",
				"Replaced spindle bearing after overheating.",
				"Kano Metal Works",
				IFEANYI,
				145000,
				3,
			),
		],
	},
	{
		id: "band-saw",
		name: "Band saw",
		serialNumber: "BS-2020-0302",
		location: "Cutting bay",
		bought: "Jul 2020",
		hourlyCost: 2000,
		serviceEveryMonths: 3,
		usedIn: "6 types",
		notes: "",
		condition: "working",
		nextService: "2027-01-10",
		hoursTotal: 2875,
		hoursMonth: 19,
		lastUsed: { when: "14 Nov 2026", job: "JC-20261114-0031 · Dining chairs × 6" },
		icon: "saw",
		history: [
			rec(
				"2026-10-10",
				"Rubber change",
				"New wheel tyres (rubber) on both wheels.",
				IBRAHIM,
				TOBI,
				12000,
			),
		],
	},
	{
		id: "industrial-sewing-machine",
		name: "Industrial sewing machine",
		serialNumber: "SW-2023-5521",
		location: "Upholstery bay",
		bought: "May 2023",
		hourlyCost: 1200,
		serviceEveryMonths: 2,
		usedIn: "Sofas, armchair, lounge chair, bed",
		notes: "",
		condition: "working",
		nextService: "2027-01-05",
		hoursTotal: 2040,
		hoursMonth: 41,
		lastUsed: { when: "Today, 13:05", job: "JC-20261117-0034 · 3-seater sofa" },
		icon: "sewing",
		history: [
			rec(
				"2026-11-05",
				"Oil change",
				"Oiled hook and needle bar; new needles.",
				"Blessing Okoro",
				TOBI,
				3500,
			),
		],
	},
	{
		id: "compressor-and-staple-guns",
		name: "Compressor and staple guns",
		serialNumber: "AC-2022-0870",
		location: "Upholstery bay",
		bought: "Sep 2022",
		hourlyCost: 1500,
		serviceEveryMonths: 1,
		usedIn: "Sofas, chairs, bed",
		notes: "Drain the tank at the end of every day.",
		condition: "working",
		nextService: "2026-11-10",
		hoursTotal: 1930,
		hoursMonth: 37,
		lastUsed: { when: "Today, 12:20", job: "JC-20261117-0034 · 3-seater sofa" },
		icon: "compressor",
		history: [
			rec(
				"2026-10-10",
				"Oil change",
				"Changed compressor oil, drained tank.",
				"Daniel Obi",
				TOBI,
				6000,
			),
			rec("2026-09-10", "Oil change", "Changed compressor oil.", "Daniel Obi", TOBI, 6000),
			rec(
				"2026-07-18",
				"Parts change",
				"New pressure switch and hose coupling.",
				"Ladipo Hardware Traders",
				IFEANYI,
				22000,
			),
		],
	},
	{
		id: "spray-booth",
		name: "Spray booth",
		serialNumber: "SB-2023-0044",
		location: "Finishing room",
		bought: "Nov 2023",
		hourlyCost: 4500,
		serviceEveryMonths: 1,
		usedIn: "Wardrobe, desk",
		notes: "Includes extraction fan and filters.",
		condition: "working",
		nextService: "2026-11-28",
		hoursTotal: 640,
		hoursMonth: 12,
		lastUsed: { when: "12 Nov 2026", job: "JC-20261110-0029 · 3-door wardrobe" },
		icon: "spray",
		history: [
			rec(
				"2026-10-28",
				"Parts change",
				"Replaced intake and exhaust filters.",
				"Samuel Etim",
				TOBI,
				28000,
			),
		],
	},
	{
		id: "edge-bander",
		name: "Edge bander",
		serialNumber: "EB-2024-0207",
		location: "Machine room",
		bought: "Jun 2024",
		hourlyCost: 3000,
		serviceEveryMonths: 3,
		usedIn: "Wardrobe",
		notes: "Waiting for a new glue pot heater from the supplier.",
		condition: "out_of_service",
		nextService: null,
		hoursTotal: 410,
		hoursMonth: 3,
		lastUsed: { when: "5 Nov 2026", job: "JC-20261103-0026 · 3-door wardrobe" },
		icon: "edge",
		history: [
			rec(
				"2026-11-06",
				"Repair",
				"Glue pot heater failed. Part ordered, expected 20 Nov.",
				IBRAHIM,
				TOBI,
				54000,
				1,
			),
			rec(
				"2026-08-06",
				"Servicing",
				"Full service and trimmer blades changed.",
				"Lagos Machine Services",
				IFEANYI,
				35000,
			),
		],
	},
];

export async function getMachines(): Promise<Machine[]> {
	return MACHINES;
}

/** One machine by its URL id, or null when there isn't one (so the page can 404). */
export async function getMachine(id: string): Promise<Machine | null> {
	return MACHINES.find((m) => m.id === id) ?? null;
}

/** Ids with a sample record, so the detail route can be prerendered. */
export const sampleMachineIds = MACHINES.map((m) => m.id);
