import dayjs from "dayjs";
import type { BadgeVariant } from "@/components/common/badge";
import type { OverviewItem } from "@/components/common/overViewCard";

// ─── Steps ───────────────────────────────────────────────────────────────────

/** Every job card goes through the same six steps, in this order. */
export const STEP_NAMES = [
	"Cutting",
	"Assembly",
	"Upholstery",
	"Finishing",
	"Quality check",
	"Delivery",
] as const;
export const DELIVERY_STEP = STEP_NAMES.length - 1;

export type StepStatus = "todo" | "active" | "done" | "redo" | "blocked";

export const STEP_STATUS: Record<StepStatus, { label: string; tone: BadgeVariant }> = {
	done: { label: "Done", tone: "success" },
	active: { label: "In progress", tone: "info" },
	todo: { label: "Not started", tone: "neutral" },
	redo: { label: "Redo", tone: "warning" },
	blocked: { label: "Waiting on parts", tone: "warning" },
};

export const REDO_REASONS = [
	"Measurements off",
	"Joint or frame loose",
	"Fabric misaligned or damaged",
	"Finish uneven or marked",
	"Wrong material or colour",
	"Other",
] as const;

export const REJECTION_REASONS = [
	"Damaged in transit",
	"Finish or fabric fault",
	"Wrong size or spec",
	"Doesn't fit the space",
	"Other",
] as const;

// ─── Types ───────────────────────────────────────────────────────────────────

export type MachineUse = { machine: string; hours: number };

export type TimeEntry = {
	id: string;
	who: string;
	/** ISO date, YYYY-MM-DD. */
	date: string;
	hours: number;
	machines: MachineUse[];
	/** Set when the work was a redo: why it was redone. */
	redoNote?: string;
};

/** Something found wrong: in the workshop, or by the client at delivery. */
export type RedoEvent = {
	id: string;
	reason: string;
	/** Extra hours expected to put it right. */
	hours: number;
	/** Which step it was found at. "Delivery" means the client rejected it. */
	foundAt: string;
	date: string;
};

export type JobStep = {
	status: StepStatus;
	plannedHours: number;
	plannedMachines: MachineUse[];
	entries: TimeEntry[];
	redos: RedoEvent[];
};

export type FurnitureKind = "sofa" | "coffee" | "lounge" | "dining" | "dchair" | "desk";

export type BuildItem = { name: string; kind: FurnitureKind; spec: string; qty: number };

export type PartStatus = "Picked" | "Reserved" | "Short" | "On order";
export type Part = { name: string; spec: string; qty: string; status: PartStatus };

export const PART_TONE: Record<PartStatus, BadgeVariant> = {
	Picked: "success",
	Reserved: "neutral",
	Short: "danger",
	"On order": "warning",
};

export type DeliveryState = "not_booked" | "booked" | "rejected" | "delivered";

export const DELIVERY_STATE: Record<DeliveryState, { label: string; tone: BadgeVariant }> = {
	not_booked: { label: "Not booked", tone: "neutral" },
	booked: { label: "Booked", tone: "info" },
	rejected: { label: "Rejected", tone: "danger" },
	delivered: { label: "Delivered", tone: "success" },
};

export type JobCard = {
	/** The job card number, e.g. JC-20261117-0034. It is also what the URL uses. */
	id: string;
	client: string;
	/** The quote it was created from, once its deposit was recorded. */
	quote: string;
	/** The items in words, for the list. */
	items: string;
	icon: FurnitureKind;
	/** ISO date. */
	due: string;
	address: string;
	delivery: { state: DeliveryState; note: string };
	/** From customer care. */
	note: string;
	build: BuildItem[];
	parts: Part[];
	steps: JobStep[];
	/** Why the card can't move on, e.g. short parts. */
	blockedNote?: string;
	/** What the client rejected, when the delivery was rejected. */
	rejectedNote?: string;
	/** Delivery accepted: the card is closed and takes no more time. */
	closed: boolean;
};

// ─── Derived figures ─────────────────────────────────────────────────────────

export const fmtHours = (n: number) => `${(Math.round(n * 10) / 10).toLocaleString("en-NG")} h`;
export const shortDate = (iso: string) => dayjs(iso).format("D MMM");
export const longDate = (iso: string) => dayjs(iso).format("D MMM YYYY");

/** Hours typed as "3.5" or "3,5". NaN when it isn't a number. */
export const parseHours = (value: string) => Number(String(value).trim().replace(",", "."));

const sum = (list: number[]) => list.reduce((a, b) => a + b, 0);

export type StepFigures = {
	actual: number;
	redoHours: number;
	machineActual: number;
	machineUses: { machine: string; planned: number; actual: number }[];
	machinePlanned: number;
};

export function stepFigures(step: JobStep): StepFigures {
	const actualBy = new Map<string, number>();
	for (const e of step.entries)
		for (const m of e.machines)
			actualBy.set(m.machine, (actualBy.get(m.machine) ?? 0) + m.hours);

	const planned = step.plannedMachines.map((m) => ({
		machine: m.machine,
		planned: m.hours,
		actual: actualBy.get(m.machine) ?? 0,
	}));
	// Machines used but not planned still show, with nothing planned
	for (const [machine, actual] of actualBy)
		if (!planned.some((p) => p.machine === machine))
			planned.push({ machine, planned: 0, actual });

	return {
		actual: sum(step.entries.map((e) => e.hours)),
		redoHours: sum(step.entries.filter((e) => e.redoNote).map((e) => e.hours)),
		machineActual: sum(planned.map((p) => p.actual)),
		machineUses: planned,
		machinePlanned: sum(planned.map((p) => p.planned)),
	};
}

export type CardFigures = {
	hours: number;
	planned: number;
	machineHours: number;
	machinePlanned: number;
	redoHours: number;
	redos: (RedoEvent & { step: number })[];
	/** The step the card is at: the first one in progress, in redo or blocked, else the first not started. */
	current: number | null;
};

export function cardFigures(card: JobCard): CardFigures {
	const figures = card.steps.map(stepFigures);
	const open = card.steps.findIndex((s) => ["active", "redo", "blocked"].includes(s.status));
	const todo = card.steps.findIndex((s) => s.status === "todo");
	return {
		hours: sum(figures.map((f) => f.actual)),
		planned: sum(card.steps.map((s) => s.plannedHours)),
		machineHours: sum(figures.map((f) => f.machineActual)),
		machinePlanned: sum(figures.map((f) => f.machinePlanned)),
		redoHours: sum(figures.map((f) => f.redoHours)),
		redos: card.steps.flatMap((s, step) => s.redos.map((r) => ({ ...r, step }))),
		current: open >= 0 ? open : todo >= 0 ? todo : null,
	};
}

/** Where the card is, in words, for the list and the page title. */
export function stepLabel(
	card: JobCard,
	current: number | null,
): { label: string; tone: BadgeVariant } {
	if (card.closed) return { label: "Delivered", tone: "success" };
	if (current === null) return { label: "Ready", tone: "success" };
	const step = card.steps[current];
	if (step.status === "blocked") return { label: "Waiting on parts", tone: "warning" };
	if (step.status === "redo") return { label: `Redo: ${STEP_NAMES[current]}`, tone: "warning" };
	return { label: STEP_NAMES[current], tone: "info" };
}

/** "14 days left", "Due today", "3 days overdue", or when it was delivered. */
export function dueNote(card: JobCard, today: string): { text: string; urgent: boolean } {
	if (card.closed) return { text: card.delivery.note, urgent: false };
	const days = dayjs(card.due).diff(dayjs(today), "day");
	if (days < 0) return { text: `${-days} ${days === -1 ? "day" : "days"} overdue`, urgent: true };
	if (days === 0) return { text: "Due today", urgent: true };
	return { text: `${days} ${days === 1 ? "day" : "days"} left`, urgent: days <= 5 };
}

export type JobPhase = "active" | "delivered";
export const phaseOf = (card: JobCard): JobPhase => (card.closed ? "delivered" : "active");

// ─── Overview figures ────────────────────────────────────────────────────────

export function buildJobCardsOverview(cards: JobCard[], today: string): OverviewItem[] {
	const all = cards.map((card) => ({ card, figures: cardFigures(card) }));
	const active = all.filter(({ card }) => !card.closed);
	const waiting = active.filter(
		({ card, figures }) =>
			figures.current !== null && card.steps[figures.current].status === "blocked",
	).length;
	const inRedo = active.filter(
		({ card, figures }) =>
			figures.current !== null && card.steps[figures.current].status === "redo",
	).length;

	const weekStart = dayjs(today).subtract(6, "day").format("YYYY-MM-DD");
	const entries = cards.flatMap((c) => c.steps.flatMap((s) => s.entries));
	const thisWeek = entries.filter((e) => e.date >= weekStart && e.date <= today);
	const people = new Set(thisWeek.map((e) => e.who)).size;
	const machineWeek = sum(thisWeek.flatMap((e) => e.machines.map((m) => m.hours)));

	const month = dayjs(today).format("YYYY-MM");
	const redos = all
		.flatMap(({ figures }) => figures.redos)
		.filter((r) => r.date.startsWith(month));
	const byStep = new Map<number, number>();
	for (const r of redos) byStep.set(r.step, (byStep.get(r.step) ?? 0) + 1);
	const mostRedone = [...byStep.entries()].sort((a, b) => b[1] - a[1])[0];

	const rejected = cards.filter((c) => c.delivery.state === "rejected");

	return [
		{
			label: "Active job cards",
			value: String(active.length),
			note: `${waiting} waiting on parts, ${inRedo} in redo`,
		},
		{
			label: "Hours logged this week",
			value: fmtHours(sum(thisWeek.map((e) => e.hours))),
			note: thisWeek.length
				? `Across ${people} ${people === 1 ? "person" : "people"} · machine time ${fmtHours(machineWeek)}`
				: "Nothing logged yet",
		},
		{
			label: "Redos this month",
			value: String(redos.length),
			note: redos.length
				? `${fmtHours(sum(redos.map((r) => r.hours)))} extra work · most at ${STEP_NAMES[mostRedone[0]].toLowerCase()}`
				: "None this month",
		},
		{
			label: "Rejected deliveries",
			value: String(rejected.length),
			note: rejected.length
				? `${rejected[0].client}: ${rejected[0].delivery.note}`
				: "None this month",
			tone: rejected.length ? "danger" : undefined,
		},
	];
}

export function buildJobCardOverview(card: JobCard, today: string): OverviewItem[] {
	const f = cardFigures(card);
	const due = dueNote(card, today);
	return [
		{
			label: "Production hours",
			value: fmtHours(f.hours),
			note: `of ${fmtHours(f.planned)} planned · ${Math.round(f.planned ? (f.hours / f.planned) * 100 : 0)}%`,
		},
		{
			label: "Machine hours",
			value: fmtHours(f.machineHours),
			note: `of ${fmtHours(f.machinePlanned)} planned · updates Machines`,
		},
		{
			label: "Redo hours",
			value: fmtHours(f.redoHours),
			note: f.redos.length
				? `${f.redos.length} ${f.redos.length === 1 ? "redo" : "redos"} · ${Math.round(f.hours ? (f.redoHours / f.hours) * 100 : 0)}% of hours`
				: "No redos",
		},
		{
			label: "Due",
			value: longDate(card.due),
			note: due.text,
			tone: due.urgent && !card.closed ? "warning" : undefined,
		},
	];
}

// ─── Changes ─────────────────────────────────────────────────────────────────
// Each returns the updated card; nothing is saved until there's a backend.

const newId = () => crypto.randomUUID();

const withStep = (card: JobCard, index: number, patch: (s: JobStep) => JobStep): JobCard => ({
	...card,
	steps: card.steps.map((s, i) => (i === index ? patch(s) : s)),
});

export type LogDraft = {
	step: number;
	who: string;
	date: string;
	hours: number;
	machines: MachineUse[];
	redoNote?: string;
	notes?: string;
	finished: boolean;
};

export function logTime(card: JobCard, draft: LogDraft): JobCard {
	const entry: TimeEntry = {
		id: newId(),
		who: draft.who,
		date: draft.date,
		hours: draft.hours,
		machines: draft.machines,
		redoNote: draft.redoNote,
	};
	return withStep(card, draft.step, (s) => ({
		...s,
		entries: [...s.entries, entry],
		// Logging on a step that wasn't started starts it; "finished" closes it
		status: draft.finished
			? "done"
			: s.status === "todo" || s.status === "blocked"
				? "active"
				: s.status,
	}));
}

/** The step goes back to Redo; steps after it that were done reopen. */
export function sendBack(
	card: JobCard,
	draft: { step: number; reason: string; hours: number; foundAt: string; date: string },
): JobCard {
	const event: RedoEvent = {
		id: newId(),
		reason: draft.reason,
		hours: draft.hours,
		foundAt: draft.foundAt,
		date: draft.date,
	};
	return {
		...card,
		steps: card.steps.map((s, i) => {
			if (i === draft.step) return { ...s, status: "redo", redos: [...s.redos, event] };
			if (i > draft.step && s.status === "done") return { ...s, status: "todo" };
			return s;
		}),
	};
}

export type DeliveryDraft = {
	outcome: "accepted" | "rejected";
	date: string;
	by: string;
	notes: string;
	what?: string;
	reason?: string;
	/** The step the rejected work goes back to; it and every step after reopen. */
	backTo?: number;
};

export function recordDelivery(card: JobCard, draft: DeliveryDraft): JobCard {
	if (draft.outcome === "accepted") {
		return {
			...card,
			closed: true,
			delivery: { state: "delivered", note: `Delivered ${shortDate(draft.date)}` },
			steps: card.steps.map((s) => ({ ...s, status: "done" })),
		};
	}
	const backTo = draft.backTo ?? 0;
	const reason = [draft.reason, draft.what].filter(Boolean).join(": ");
	const event: RedoEvent = {
		id: newId(),
		reason: `Delivery rejected: ${reason}.`,
		hours: 4,
		foundAt: "Delivery",
		date: draft.date,
	};
	return {
		...card,
		delivery: {
			state: "rejected",
			note: `Rejected ${shortDate(draft.date)}: ${draft.what ?? "see notes"}`,
		},
		rejectedNote: `${draft.what ?? "Part of the delivery"} was rejected at delivery on ${shortDate(draft.date)} (${(draft.reason ?? "see notes").toLowerCase()}). ${STEP_NAMES[backTo]} and the steps after it are reopened.`,
		steps: card.steps.map((s, i) =>
			i < backTo
				? s
				: { ...s, status: "redo", redos: i === backTo ? [...s.redos, event] : s.redos },
		),
	};
}

// ─── Sample data ─────────────────────────────────────────────────────────────
// TODO: replace with real job cards once there's a backend. The sample cards
// from the design (all illustrative). The pages only read job cards through
// getJobCards / getJobCard, so swapping in real data is a one-file change.

/** Everyone who can log time. TODO: read from the staff list. */
export const WORKSHOP_PEOPLE = [
	"Babatunde Afolabi",
	"Emeka Nwachukwu",
	"Yusuf Garba",
	"Blessing Okoro",
	"Kunle Adeyemi",
	"Samuel Etim",
	"Ibrahim Musa",
	"Daniel Obi",
	"Peter Udo",
	"Tobi Adekunle",
] as const;

const mu = (machine: string, hours: number): MachineUse => ({ machine, hours });

const entry = (
	who: string,
	date: string,
	hours: number,
	machines: MachineUse[] = [],
	redoNote?: string,
): TimeEntry => ({
	id: `${who}-${date}-${hours}`.replace(/\s+/g, "-").toLowerCase(),
	who,
	date,
	hours,
	machines,
	redoNote,
});

const redo = (reason: string, hours: number, foundAt: string, date: string): RedoEvent => ({
	id: `${date}-${foundAt}`.replace(/\s+/g, "-").toLowerCase(),
	reason,
	hours,
	foundAt,
	date,
});

const step = (
	status: StepStatus,
	plannedHours: number,
	entries: TimeEntry[] = [],
	plannedMachines: MachineUse[] = [],
	redos: RedoEvent[] = [],
): JobStep => ({ status, plannedHours, plannedMachines, entries, redos });

const SEWING = "Industrial sewing machine";
const STAPLE = "Compressor and staple guns";

const JOB_CARDS: JobCard[] = [
	{
		id: "JC-20261117-0034",
		client: "Adaeze Okafor",
		quote: "MAJ-QT-20261107-1432",
		items: "3-seater sofa, coffee table",
		icon: "sofa",
		due: "2026-12-01",
		address: "14 Admiralty Way, Lekki Phase 1, Lagos",
		delivery: { state: "booked", note: "Booked for 30 Nov" },
		note: "Bouclé from one dye lot only. Client is home after 3pm.",
		closed: false,
		build: [
			{
				name: "3-seater sofa",
				kind: "sofa",
				spec: "Walnut frame, oat bouclé, pocket-spring seat, tapered brass legs",
				qty: 1,
			},
			{
				name: "Coffee table",
				kind: "coffee",
				spec: "Walnut slab top 120 × 60 cm, brass inlay, hardwax oil",
				qty: 1,
			},
		],
		parts: [
			{ name: "Walnut hardwood", spec: '2" × 4", kiln-dried', qty: "14", status: "Picked" },
			{ name: "Walnut slab", spec: "120 × 60 × 4 cm", qty: "1", status: "Picked" },
			{ name: "High-density foam 40D", spec: '6" sheet', qty: "3", status: "Picked" },
			{ name: "Bouclé fabric, oat", spec: "Per yard", qty: "14 yd", status: "Picked" },
			{ name: "Pocket spring unit", spec: "3-seat set", qty: "1", status: "Picked" },
			{ name: "Tapered brass legs", spec: '6", set screw', qty: "4", status: "Reserved" },
			{ name: "Brass inlay strip", spec: "8 mm", qty: "4 m", status: "Picked" },
		],
		steps: [
			step(
				"done",
				13,
				[
					entry("Babatunde Afolabi", "2026-11-10", 6, [
						mu("Table saw", 3),
						mu("Planer and thicknesser", 2),
					]),
					entry("Emeka Nwachukwu", "2026-11-10", 4.5, [
						mu("Table saw", 2),
						mu("CNC router", 1),
					]),
					entry("Daniel Obi", "2026-11-11", 3),
				],
				[mu("Table saw", 5), mu("Planer and thicknesser", 3), mu("CNC router", 1)],
			),
			step(
				"done",
				15,
				[
					entry("Babatunde Afolabi", "2026-11-12", 7),
					entry("Yusuf Garba", "2026-11-12", 5),
					entry("Daniel Obi", "2026-11-13", 3),
					entry(
						"Yusuf Garba",
						"2026-11-14",
						3,
						[],
						"Left arm frame loose at the back rail; re-glued and clamped",
					),
				],
				[],
				[
					redo(
						"Joint or frame loose: left arm at the back rail. Found when upholstery started.",
						3,
						"Upholstery",
						"2026-11-14",
					),
				],
			),
			step(
				"active",
				18,
				[
					entry("Blessing Okoro", "2026-11-15", 5, [mu(SEWING, 3), mu(STAPLE, 2)]),
					entry("Kunle Adeyemi", "2026-11-18", 4, [mu(STAPLE, 1.5)]),
				],
				[mu(SEWING, 6), mu(STAPLE, 4)],
			),
			step("todo", 6),
			step("todo", 1),
			step("todo", 2),
		],
	},
	{
		id: "JC-20261105-0029",
		client: "Harbourview Suites",
		quote: "MAJ-QT-20261104-1620",
		items: "Lounge chairs × 12",
		icon: "lounge",
		due: "2026-11-21",
		address: "Harbourview Suites, Victoria Island, Lagos",
		delivery: { state: "rejected", note: "Rejected 14 Nov: 2 of 12" },
		note: "Engraved name plate on each chair back. Deliver through the service entrance.",
		closed: false,
		rejectedNote:
			"2 of 12 chairs were rejected at delivery on 14 Nov (bouclé snagged in transit). Upholstery and the steps after it are reopened for those 2 chairs.",
		build: [
			{
				name: "Lounge chair",
				kind: "lounge",
				spec: "Walnut frame, oat bouclé, tapered brass legs, engraved brass plate",
				qty: 12,
			},
		],
		parts: [
			{ name: "Walnut hardwood", spec: '2" × 4", kiln-dried', qty: "84", status: "Picked" },
			{ name: "High-density foam 40D", spec: '6" sheet', qty: "12", status: "Picked" },
			{ name: "Bouclé fabric, oat", spec: "Per yard", qty: "66 yd", status: "Picked" },
			{ name: "Tapered brass legs", spec: '6", set screw', qty: "48", status: "Picked" },
		],
		steps: [
			step(
				"done",
				36,
				[
					entry("Babatunde Afolabi", "2026-11-06", 18, [
						mu("Table saw", 8),
						mu("Band saw", 4),
					]),
					entry("Emeka Nwachukwu", "2026-11-06", 16, [mu("Table saw", 6)]),
				],
				[mu("Table saw", 14), mu("Band saw", 4)],
			),
			step("done", 48, [
				entry("Yusuf Garba", "2026-11-08", 26),
				entry("Emeka Nwachukwu", "2026-11-08", 24),
			]),
			step(
				"redo",
				60,
				[
					entry("Blessing Okoro", "2026-11-11", 30, [mu(SEWING, 14), mu(STAPLE, 8)]),
					entry("Kunle Adeyemi", "2026-11-12", 28, [mu(SEWING, 10), mu(STAPLE, 8)]),
					entry(
						"Kunle Adeyemi",
						"2026-11-18",
						4,
						[mu(SEWING, 2)],
						"Re-covering seat of chair 7",
					),
				],
				[mu(SEWING, 24), mu(STAPLE, 16)],
				[
					redo(
						"Delivery rejected: bouclé snagged on 2 chairs in transit. Re-cover seats.",
						8,
						"Delivery",
						"2026-11-14",
					),
				],
			),
			step("redo", 12, [entry("Samuel Etim", "2026-11-13", 12)]),
			step("redo", 3, [entry("Tobi Adekunle", "2026-11-13", 3)]),
			step(
				"redo",
				4,
				[entry("Musa Bello", "2026-11-14", 4)],
				[],
				[
					redo(
						"Delivery rejected: 2 of 12 chairs. Client signed for 10.",
						4,
						"Delivery",
						"2026-11-14",
					),
				],
			),
		],
	},
	{
		id: "JC-20261107-0031",
		client: "Tunde Bakare",
		quote: "MAJ-QT-20261106-1015",
		items: "Dining table, 6 chairs",
		icon: "dining",
		due: "2026-11-28",
		address: "7 Isaac John Street, GRA Ikeja, Lagos",
		delivery: { state: "not_booked", note: "Not booked" },
		note: "Chairs’ woven cord in natural, not black. Delivery after 4pm on weekdays.",
		closed: false,
		blockedNote:
			"Waiting on walnut slab and paper cord from procurement before cutting can start.",
		build: [
			{
				name: "Dining table, seats 8",
				kind: "dining",
				spec: "Solid walnut, 220 × 100 cm, hardwax oil",
				qty: 1,
			},
			{
				name: "Dining chair",
				kind: "dchair",
				spec: "Walnut frame, woven paper cord seat (natural)",
				qty: 6,
			},
		],
		parts: [
			{ name: "Walnut slab", spec: "220 × 100 × 4 cm", qty: "1", status: "Short" },
			{ name: "Walnut hardwood", spec: '2" × 4", kiln-dried', qty: "32", status: "Reserved" },
			{ name: "Woven paper cord", spec: "Natural, per metre", qty: "36 m", status: "Short" },
			{ name: "Hardwax oil finish", spec: "1 L tin", qty: "4", status: "Reserved" },
		],
		steps: [
			step(
				"blocked",
				30,
				[],
				[mu("Table saw", 8), mu("Planer and thicknesser", 4), mu("Band saw", 6)],
			),
			step("todo", 34),
			step("todo", 30),
			step("todo", 10, [], [mu("Spray booth", 2)]),
			step("todo", 2),
			step("todo", 3),
		],
	},
	{
		id: "JC-20261030-0027",
		client: "Moyo & Okeke Interiors",
		quote: "MAJ-QT-20261021-0940",
		items: "Reception desk",
		icon: "desk",
		due: "2026-11-12",
		address: "22 Bourdillon Road, Ikoyi, Lagos",
		delivery: { state: "delivered", note: "Collected 11 Nov" },
		note: "Trade client; their installer collected from the workshop.",
		closed: true,
		build: [
			{
				name: "Reception desk",
				kind: "desk",
				spec: "Walnut veneer, 240 cm curved front, brass kick plate",
				qty: 1,
			},
		],
		parts: [
			{ name: "Walnut veneer board", spec: "2440 × 1220 mm", qty: "6", status: "Picked" },
		],
		steps: [
			step(
				"done",
				8,
				[entry("Babatunde Afolabi", "2026-11-01", 8, [mu("CNC router", 3)])],
				[mu("CNC router", 3)],
			),
			step(
				"done",
				14,
				[entry("Yusuf Garba", "2026-11-03", 15, [mu("Edge bander", 2)])],
				[mu("Edge bander", 2)],
			),
			step("done", 0),
			step(
				"done",
				8,
				[entry("Samuel Etim", "2026-11-06", 9, [mu("Spray booth", 3)])],
				[mu("Spray booth", 2)],
			),
			step("done", 1, [entry("Tobi Adekunle", "2026-11-07", 1)]),
			step("done", 2, [entry("Musa Bello", "2026-11-11", 1)]),
		],
	},
];

export async function getJobCards(): Promise<JobCard[]> {
	return JOB_CARDS;
}

/** One job card by its URL id, or null when there isn't one (so the page can 404). */
export async function getJobCard(id: string): Promise<JobCard | null> {
	return JOB_CARDS.find((c) => c.id === id) ?? null;
}

/** Ids with a sample record, so the detail route can be prerendered. */
export const sampleJobCardIds = JOB_CARDS.map((c) => c.id);
