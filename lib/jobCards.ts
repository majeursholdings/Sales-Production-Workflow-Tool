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

/** Hours on one machine. `machine` is its name, for showing. */
export type MachineUse = { machineId: string; machine: string; hours: number };

/** Someone in the Production team who can log time. */
export type WorkshopPerson = { id: string; name: string };

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

export type FurnitureKind =
	"sofa" | "coffee" | "lounge" | "dining" | "dchair" | "desk" | "bed" | "storage" | "other";

/** The icon an item gets from its name, e.g. "3-seater sofa" → sofa. */
export function kindOf(name: string): FurnitureKind {
	const n = name.toLowerCase();
	if (/sofa|couch|sectional|settee/.test(n)) return "sofa";
	if (/coffee|side table|console/.test(n)) return "coffee";
	if (/dining chair|chair.*dining/.test(n)) return "dchair";
	if (/dining|table/.test(n)) return "dining";
	if (/lounge|armchair|chair|stool|ottoman/.test(n)) return "lounge";
	if (/desk|reception|office/.test(n)) return "desk";
	if (/bed|headboard/.test(n)) return "bed";
	if (/wardrobe|cabinet|shelf|shelves|dresser|drawer|sideboard|tv/.test(n)) return "storage";
	return "other";
}

export type BuildItem = { name: string; kind: FurnitureKind; spec: string; qty: number };

export type PartStatus = "Picked" | "Reserved" | "Short" | "On order";
export type Part = { sku: string; name: string; spec: string; qty: string; status: PartStatus };

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
	/** The job card number, e.g. JC-YYYYMMDD-0001. It is also what the URL uses. */
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
	delivery: { state: DeliveryState; note: string; bookedFor?: string };
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
	machineUses: { machineId: string; machine: string; planned: number; actual: number }[];
	machinePlanned: number;
};

export function stepFigures(step: JobStep): StepFigures {
	const actualBy = new Map<string, { machine: string; hours: number }>();
	for (const e of step.entries)
		for (const m of e.machines)
			actualBy.set(m.machineId, {
				machine: m.machine,
				hours: (actualBy.get(m.machineId)?.hours ?? 0) + m.hours,
			});

	const planned = step.plannedMachines.map((m) => ({
		machineId: m.machineId,
		machine: m.machine,
		planned: m.hours,
		actual: actualBy.get(m.machineId)?.hours ?? 0,
	}));
	// Machines used but not planned still show, with nothing planned
	for (const [machineId, used] of actualBy)
		if (!planned.some((p) => p.machineId === machineId))
			planned.push({ machineId, machine: used.machine, planned: 0, actual: used.hours });

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
// Each returns the updated card. The server actions apply them to the saved
// card to work out the new step statuses, so the rules live in one place.

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

// ─── Creating a job card ─────────────────────────────────────────────────────

/** A quote with its deposit paid and no job card yet, to start one from. */
export type QuoteOption = {
	id: string;
	number: string;
	clientId: string | null;
	client: string;
	/** The client's location, as a starting delivery address. */
	address: string;
	items: { name: string; spec: string; qty: number }[];
};

/** A part in stock, for the picking list. */
export type PartOption = { sku: string; name: string; unit: string; available: number };

/** "3-seater sofa, coffee table", or "Lounge chairs × 12" for one item. */
export function itemsSummary(items: { name: string; qty: number }[]) {
	return items
		.map((item, i) => {
			const name = i === 0 ? item.name : item.name.toLowerCase();
			return item.qty > 1 ? `${name} × ${item.qty}` : name;
		})
		.join(", ");
}
