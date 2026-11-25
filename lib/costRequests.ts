import dayjs from "dayjs";
import type { BadgeVariant } from "@/components/common/badge";
import { availableOf, type Inventory } from "@/lib/inventory";

// ─── Types ───────────────────────────────────────────────────────────────────

/** Below this the parts agent isn't sure enough of a match, so procurement checks it. */
export const CONFIDENCE_THRESHOLD = 85;

/** Another part the agent suggests for one that isn't in inventory. */
export type Substitute = {
	id: string;
	name: string;
	sku: string;
	qty: number;
	unitCost: number;
	/** Why it fits, and what changes. */
	why: string;
};

/** One part the parts agent matched (or failed to match) from the photo and notes. */
export type RequestPart = {
	id: string;
	name: string;
	/** Inventory SKU, or null when the part isn't in inventory. */
	sku: string | null;
	/** What it's for, e.g. "Frame". */
	use: string;
	qty: number;
	/** Naira per unit; 0 when it isn't priced yet. */
	unitCost: number;
	/** How sure the agent is of the match, 0–100. */
	confidence: number;
	/** missing: not in inventory · priced: procurement priced it as a one-off. */
	kind: "stock" | "missing" | "priced";
	/** Shown when the part isn't counted in inventory, e.g. "Workshop rate". */
	note?: string;
	/** Where it is on the photo, as % from the left and top; null when it can't be seen. */
	pin: [number, number] | null;
	/** Why the agent is unsure, for a low-confidence match. */
	doubt?: string;
	/** The requester asked procurement to add it to inventory. */
	askedToAdd?: boolean;
	/** A one-off price suggested from similar work, for a missing part. */
	suggestion?: { unitCost: number; supplierId: string; leadDays: number };
	substitutes?: Substitute[];
};

/** How procurement settled a flagged part. */
export type Resolution =
	| { kind: "keep" }
	| { kind: "drop" }
	| { kind: "sub"; id: string }
	| {
			kind: "oneOff";
			unitCost: number;
			supplierId: string;
			leadDays: number;
			addToInventory: boolean;
	  };

export type RequestMessage = { by: string; text: string; at: string };

export type CostRequest = {
	id: string;
	title: string;
	/** "New piece", or what it adds to, e.g. "Addition to side table". */
	target: string;
	/** A whole new piece (so it can be saved as a furniture type) rather than an addition. */
	newPiece: boolean;
	client: string;
	quote: string;
	requestedBy: string;
	/** ISO date-time. */
	requestedAt: string;
	/** ISO date. */
	neededBy: string;
	size: string;
	quantity: number;
	markupPercent: number;
	/** The markup's category, e.g. "Sofas". */
	markupCategory: string;
	notes: string;
	images: { src: string; alt: string }[];
	parts: RequestPart[];
	status: "open" | "approved" | "declined";
	/** Part id → how it was settled. */
	resolutions: Record<string, Resolution>;
	questions: RequestMessage[];
	declineReason: string | null;
	alternative: string | null;
	approvedBy: string | null;
	/** Cost per piece when approved. */
	approvedCost: number | null;
};

// ─── Labels ──────────────────────────────────────────────────────────────────

export type RequestStatus = "review" | "waiting" | "approved" | "declined";

export const REQUEST_STATUS: Record<RequestStatus, { label: string; tone: BadgeVariant }> = {
	review: { label: "To review", tone: "warning" },
	waiting: { label: "Waiting on reply", tone: "info" },
	approved: { label: "Approved", tone: "success" },
	declined: { label: "Can't source", tone: "danger" },
};

export const DECLINE_REASONS = [
	{ value: "nosupplier", label: "No supplier can make it", short: "no supplier can make it" },
	{ value: "deadline", label: "Can't be made by the date needed", short: "can't be made by" },
	{
		value: "cost",
		label: "Cost would be far above budget",
		short: "cost would be far above budget",
	},
	{
		value: "material",
		label: "Material is discontinued or unavailable",
		short: "material unavailable",
	},
] as const;

export const firstName = (name: string) => name.split(" ")[0];
export const initials = (name: string) =>
	name
		.split(" ")
		.map((w) => w[0])
		.join("")
		.slice(0, 2);

/** ₦634,000 */
export const naira = (n: number) => `₦${Math.round(n).toLocaleString("en-NG")}`;

export const neededLabel = (iso: string) => dayjs(iso).format("ddd, D MMM");

/** "3 hours ago", "1 day ago", from `now`. */
export function ageLabel(iso: string, now: string) {
	const mins = dayjs(now).diff(dayjs(iso), "minute");
	if (mins < 60) return mins <= 1 ? "just now" : `${mins} minutes ago`;
	const hours = Math.floor(mins / 60);
	if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
	const days = Math.floor(hours / 24);
	return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function statusOf(r: CostRequest): RequestStatus {
	if (r.status !== "open") return r.status;
	const last = r.questions.at(-1);
	return last && last.by !== r.requestedBy ? "waiting" : "review";
}

// ─── Review: what each part costs and what's still to settle ─────────────────

export type PartRow = {
	part: RequestPart;
	num: number;
	/** The name shown: a substitute's, when one is used. */
	name: string;
	sku: string | null;
	/** "34 available", "Workshop rate", "No matching part". */
	availability: string;
	qty: number;
	/** Null until it's priced. */
	unitCost: number | null;
	line: number | null;
	missing: boolean;
	unsure: boolean;
	dropped: boolean;
	resolution: Resolution | undefined;
	/** Still needs procurement's decision. */
	open: boolean;
	/** Pin and number colour. */
	tone: "" | "unsure" | "miss" | "sub" | "none";
	badge: { label: string; tone: BadgeVariant } | null;
};

export type Review = {
	rows: PartRow[];
	/** Parts and labour, per piece. */
	cost: number;
	markup: number;
	price: number;
	/** Parts still to settle before it can be approved. */
	open: number;
	flagged: number;
	flags: string[];
};

export function reviewOf(r: CostRequest, inventory: Inventory): Review {
	const settled = r.status !== "open";
	const rows = r.parts.map((part, i): PartRow => {
		const num = i + 1;
		const res = r.resolutions[part.id];
		const missing = part.kind === "missing";
		const unsure = !missing && part.confidence < CONFIDENCE_THRESHOLD;
		const sub =
			missing && res?.kind === "sub"
				? part.substitutes?.find((s) => s.id === res.id)
				: undefined;
		const oneOff = missing && res?.kind === "oneOff" ? res : undefined;
		const dropped = unsure && res?.kind === "drop";

		const sku = sub?.sku ?? part.sku;
		const qty = dropped ? 0 : (sub?.qty ?? part.qty);
		const unitCost = sub
			? sub.unitCost
			: oneOff
				? oneOff.unitCost
				: missing
					? null
					: part.unitCost;
		const stocked = sku ? inventory.parts.find((p) => p.sku === sku) : undefined;
		const avail = stocked ? availableOf(stocked) : null;
		const low = !!stocked && avail !== null && avail <= stocked.reorderLevel;

		return {
			part,
			num,
			name: sub ? `${sub.name} (for ${part.name.toLowerCase()})` : part.name,
			sku,
			availability: stocked
				? `${Math.max(0, avail ?? 0)} available`
				: (part.note ?? (missing ? "No matching part" : "")),
			qty,
			unitCost,
			line: unitCost === null ? null : qty * unitCost,
			missing,
			unsure,
			dropped,
			resolution: res,
			open:
				!settled &&
				(missing ? !sub && !(oneOff && oneOff.unitCost > 0) : unsure ? !res : false),
			tone: dropped
				? "none"
				: sub
					? "sub"
					: missing
						? "miss"
						: unsure && !res
							? "unsure"
							: "",
			badge: dropped
				? { label: "Removed", tone: "neutral" }
				: sub
					? { label: "Substitute", tone: "success" }
					: oneOff
						? { label: "One-off price", tone: "info" }
						: missing
							? { label: "Not in inventory", tone: "danger" }
							: part.kind === "priced"
								? { label: "Priced by procurement", tone: "info" }
								: low
									? { label: "Low stock", tone: "warning" }
									: null,
		};
	});

	const cost = rows.reduce((sum, row) => sum + (row.line ?? 0), 0);
	const markup = (cost * r.markupPercent) / 100;
	const flaggedRows = rows.filter((row) => row.missing || row.unsure);
	const by = firstName(r.requestedBy);

	return {
		rows,
		cost,
		markup,
		price: cost + markup,
		open: rows.filter((row) => row.open).length,
		flagged: flaggedRows.length,
		flags: flaggedRows.map((row) =>
			row.missing
				? `${row.num} · ${row.part.name} isn't in inventory.${row.part.askedToAdd ? ` ${by} asked you to add it.` : ""}`
				: `${row.num} · ${row.part.name}: the agent is only ${row.part.confidence}% sure.`,
		),
	};
}

// ─── Form values ─────────────────────────────────────────────────────────────
// Procurement's choices for flagged parts live in one react-hook-form form,
// one set of fields per request and part: `<request>:<part>:fix` and, for a
// one-off price, `:cost`, `:supplier`, `:lead` and `:addInv`.

export type FixValues = Record<string, string | boolean | undefined>;

export const fixKey = (requestId: string, partId: string, field: string) =>
	`${requestId}:${partId}:${field}`;

/** The form's starting values: no choice made, one-off fields filled from the agent's suggestion. */
export function fixDefaults(requests: CostRequest[], fallbackSupplierId: string): FixValues {
	return Object.fromEntries(
		requests.flatMap((r) =>
			r.parts
				.filter((p) => p.kind === "missing")
				.flatMap((p) => [
					[fixKey(r.id, p.id, "cost"), String(p.suggestion?.unitCost ?? "")],
					[
						fixKey(r.id, p.id, "supplier"),
						p.suggestion?.supplierId ?? fallbackSupplierId,
					],
					[fixKey(r.id, p.id, "lead"), String(p.suggestion?.leadDays ?? 5)],
					[fixKey(r.id, p.id, "addInv"), true],
				]),
		),
	);
}

/** How each flagged part is settled, read from the form. */
export function resolutionsFrom(values: FixValues, r: CostRequest): Record<string, Resolution> {
	const out: Record<string, Resolution> = {};
	for (const p of r.parts) {
		const fix = String(values[fixKey(r.id, p.id, "fix")] ?? "");
		if (fix === "keep" || fix === "drop") out[p.id] = { kind: fix };
		else if (fix.startsWith("sub:")) out[p.id] = { kind: "sub", id: fix.slice(4) };
		else if (fix === "oneOff")
			out[p.id] = {
				kind: "oneOff",
				unitCost: Number(values[fixKey(r.id, p.id, "cost")]) || 0,
				supplierId: String(values[fixKey(r.id, p.id, "supplier")] ?? ""),
				leadDays: Number(values[fixKey(r.id, p.id, "lead")]) || 0,
				addToInventory: !!values[fixKey(r.id, p.id, "addInv")],
			};
	}
	return out;
}

// ─── Sample data ─────────────────────────────────────────────────────────────
// TODO: replace with the cost_requests table once the parts agent writes to
// it. The requests are the design's sample (all illustrative), and the photos
// are the design's mock-ups in public/samples. The page only reads requests
// through getCostRequests, so swapping in real data is a one-file change.

const base = {
	status: "open" as const,
	resolutions: {},
	questions: [],
	declineReason: null,
	alternative: null,
	approvedBy: null,
	approvedCost: null,
};

const REQUESTS: CostRequest[] = [
	{
		...base,
		id: "CR-0014",
		title: "Curved channel-tufted sofa",
		target: "New piece",
		newPiece: true,
		client: "Adaeze Okafor",
		quote: "MAJ-QT-20261107-1432",
		requestedBy: "Chiamaka Eze",
		requestedAt: "2026-11-07T11:20:00",
		neededBy: "2026-11-09",
		size: "260 × 95 × 78 cm",
		quantity: 1,
		markupPercent: 35,
		markupCategory: "Sofas",
		notes: "Curved sofa like the photo, channel-tufted back, sitting on a brass base. Client wants oat bouclé.",
		images: [
			{
				src: "/samples/cost-requests/curved-sofa.svg",
				alt: "Client's photo: a curved sofa with a channel-tufted back in oat bouclé, on a brass base",
			},
		],
		parts: [
			{
				id: "wal",
				name: "Walnut hardwood",
				sku: "TMB-WAL-24",
				use: "Frame",
				qty: 14,
				unitCost: 18500,
				confidence: 94,
				kind: "stock",
				pin: [20, 60],
			},
			{
				id: "bcl",
				name: "Bouclé fabric, oat",
				sku: "UPH-BCL-OAT",
				use: "Upholstery",
				qty: 18,
				unitCost: 9800,
				confidence: 88,
				kind: "stock",
				pin: [50, 40],
			},
			{
				id: "foam",
				name: "High-density foam 40D",
				sku: "UPH-FOAM-40",
				use: "Seat and back",
				qty: 4,
				unitCost: 32000,
				confidence: 90,
				kind: "stock",
				pin: [64, 62],
			},
			{
				id: "spr",
				name: "Pocket spring unit",
				sku: "SEA-PKT-3S",
				use: "Seat",
				qty: 1,
				unitCost: 45000,
				confidence: 64,
				kind: "stock",
				pin: [36, 63],
				doubt: "Springs aren't visible in the photo. The agent assumed them from the seat depth; it could be a foam-only seat.",
			},
			{
				id: "base",
				name: "Curved brass plinth base",
				sku: null,
				use: "Base",
				qty: 1,
				unitCost: 0,
				confidence: 91,
				kind: "missing",
				pin: [50, 77.5],
				askedToAdd: true,
				suggestion: {
					unitCost: 96000,
					supplierId: "ladipo-hardware-traders",
					leadDays: 12,
				},
				substitutes: [
					{
						id: "a",
						name: "Brass inlay strip, 6 m",
						sku: "HDW-INL-8MM",
						qty: 6,
						unitCost: 4500,
						why: "Wrapped round a walnut plinth. Closest to the photo.",
					},
					{
						id: "b",
						name: "Tapered brass legs, 6",
						sku: "HDW-LEG-BR6",
						qty: 6,
						unitCost: 6500,
						why: "Legs instead of a solid base. Changes the look.",
					},
				],
			},
			{
				id: "lab",
				name: "Production labour",
				sku: "LAB-WS",
				use: "Workshop · estimated",
				qty: 1,
				unitCost: 150000,
				confidence: 86,
				kind: "stock",
				note: "3-seater rate plus 25%",
				pin: null,
			},
		],
	},
	{
		...base,
		id: "CR-0013",
		title: "Engraved brass name plate",
		target: "Addition to lounge chair × 12",
		newPiece: false,
		client: "Harbourview Suites",
		quote: "MAJ-QT-20261104-1620",
		requestedBy: "Emeka Obi",
		requestedAt: "2026-11-06T14:05:00",
		neededBy: "2026-11-10",
		size: "20 × 6 cm",
		quantity: 12,
		markupPercent: 28,
		markupCategory: "Chairs",
		notes: "One per lounge chair, hotel logo supplied as vector.",
		images: [
			{
				src: "/samples/cost-requests/brass-name-plate.svg",
				alt: "Mock-up: the back of a lounge chair with an engraved brass name plate at the top",
			},
		],
		parts: [
			{
				id: "plate",
				name: "Engraved brass plate, 20 × 6 cm",
				sku: null,
				use: "Plate",
				qty: 1,
				unitCost: 0,
				confidence: 93,
				kind: "missing",
				pin: [50, 30],
				askedToAdd: true,
				suggestion: { unitCost: 7000, supplierId: "ladipo-hardware-traders", leadDays: 8 },
				substitutes: [],
			},
			{
				id: "nail",
				name: "Brass nailhead trim",
				sku: "HDW-NAIL-BR",
				use: "Fixings",
				qty: 4,
				unitCost: 450,
				confidence: 88,
				kind: "stock",
				note: "410 available",
				pin: [62, 33],
			},
			{
				id: "lab",
				name: "Production labour",
				sku: "LAB-WS",
				use: "Fitting · estimated",
				qty: 1,
				unitCost: 700,
				confidence: 90,
				kind: "stock",
				note: "Workshop rate",
				pin: null,
			},
		],
	},
	{
		...base,
		id: "CR-0011",
		title: "Green marble table top",
		target: "Addition to side table",
		newPiece: false,
		client: "Fatima Bello",
		quote: "MAJ-QT-20261105-1300",
		requestedBy: "Chiamaka Eze",
		requestedAt: "2026-11-04T09:30:00",
		neededBy: "2026-11-05",
		size: "90 cm round, 2 cm",
		quantity: 1,
		markupPercent: 30,
		markupCategory: "Tables",
		notes: "Side table top swap from walnut to marble.",
		images: [
			{
				src: "/samples/cost-requests/green-marble-top.svg",
				alt: "Photo: a round green marble top on a walnut side table",
			},
		],
		parts: [
			{
				id: "top",
				name: "Green marble top, 90 cm round",
				sku: null,
				use: "Top",
				qty: 1,
				unitCost: 185000,
				confidence: 96,
				kind: "priced",
				note: "Priced by procurement",
				pin: [50, 36],
			},
			{
				id: "lab",
				name: "Production labour",
				sku: "LAB-WS",
				use: "Workshop · estimated",
				qty: 1,
				unitCost: 27000,
				confidence: 88,
				kind: "stock",
				note: "Workshop rate",
				pin: null,
			},
		],
		status: "approved",
		approvedBy: "Ifeanyi Nwosu",
		approvedCost: 212000,
	},
];

export async function getCostRequests(): Promise<CostRequest[]> {
	return REQUESTS;
}
