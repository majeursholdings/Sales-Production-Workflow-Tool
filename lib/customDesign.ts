import type { BadgeVariant } from "@/components/common/badge";
import type { AgentRules } from "@/lib/companySettings";
import type { PartRow, RequestPart, Substitute } from "@/lib/costRequests";

// ─── What the parts agent returns ────────────────────────────────────────────

export type DesignScope = "new" | "addition";

/** One part on the agent's list, with stock as it stood when the agent ran. */
export type DesignPart = RequestPart & {
	/** Unit the quantity is in, e.g. "yd", "piece", "3-seat set". */
	unit: string;
	/** "34 available", "Workshop rate"; empty for a part that isn't in inventory. */
	availability: string;
	/** At or below its reorder level. */
	lowStock: boolean;
	/** The unit each substitute's quantity is in, by substitute id. */
	substituteUnits?: Record<string, string>;
};

/** The agent's parts list for one design, per piece. */
export type DesignResult = {
	/** What the agent calls the piece, e.g. "Curved channel-tufted sofa". */
	title: string;
	scope: DesignScope;
	/** "New piece", or "Addition to 3-seater sofa". */
	target: string;
	/** Name of the piece it adds to, for an addition. */
	targetName: string | null;
	size: string;
	quantity: number;
	description: string;
	images: { src: string; alt: string }[];
	parts: DesignPart[];
	/** Markup for the piece's category, as a whole percentage. */
	markupPercent: number;
	markupCategory: string;
	/** How the agent estimated labour, shown under the price. */
	labourNote: string;
};

/** For each part that isn't in inventory: a substitute's id, or "ask" to have procurement add it. */
export type MissingChoices = Record<string, string | undefined>;

export const ASK_PROCUREMENT = "ask";

// ─── Where the design stands ─────────────────────────────────────────────────

export type DesignRow = {
	part: DesignPart;
	num: number;
	/** The name shown: a substitute's, when one is picked. */
	name: string;
	sku: string | null;
	/** "TMB-WAL-24 · 34 available", or "No matching part". */
	skuLine: string;
	qty: number;
	unit: string;
	/** Null until procurement prices it. */
	unitCost: number | null;
	line: number | null;
	missing: boolean;
	unsure: boolean;
	sub: Substitute | undefined;
	/** Pin and number colour, as on the procurement side. */
	tone: PartRow["tone"];
	badge: { label: string; tone: BadgeVariant } | null;
};

export type DesignAssessment = {
	rows: DesignRow[];
	/** Parts and labour that are priced, per piece. */
	cost: number;
	markup: number;
	price: number;
	/** Names of parts still to be priced by procurement. */
	pending: string[];
	/** Why procurement has to check it, one line per part. */
	reasons: string[];
	/** Every custom design goes to procurement (Settings › Custom design agent). */
	alwaysReview: boolean;
	/** Can go straight on the quote. */
	ready: boolean;
};

/** Works out each line, the price per piece and whether procurement must check it, under the agent rules. */
export function assessDesign(
	result: DesignResult,
	choices: MissingChoices,
	rules: AgentRules,
): DesignAssessment {
	let cost = 0;
	const pending: string[] = [];
	const reasons: string[] = [];

	const rows = result.parts.map((part, i): DesignRow => {
		const num = i + 1;
		const missing = part.kind === "missing";
		const choice = choices[part.id];
		const sub = missing ? part.substitutes?.find((s) => s.id === choice) : undefined;
		const unsure = part.confidence < rules.threshold;
		const unpriced = missing && !sub;

		const qty = sub?.qty ?? part.qty;
		const unit = sub ? (part.substituteUnits?.[sub.id] ?? part.unit) : part.unit;
		const unitCost = sub ? sub.unitCost : unpriced ? null : part.unitCost;
		const line = unitCost === null ? null : qty * unitCost;
		const sku = sub?.sku ?? part.sku;

		if (line === null) pending.push(part.name);
		else cost += line;
		if (unsure) {
			reasons.push(
				`${num} · ${part.name}: the agent is only ${part.confidence}% sure.${part.doubt ? ` ${part.doubt}` : ""}`,
			);
		}
		if (unpriced) {
			reasons.push(
				`${num} · ${part.name} isn't in inventory. Procurement will price it and add it.`,
			);
		}
		if (!missing && part.lowStock && rules.lowStockToProcurement) {
			reasons.push(`${num} · ${part.name} is low on stock.`);
		}

		return {
			part,
			num,
			name: sub ? `${sub.name} (for ${part.name.toLowerCase()})` : part.name,
			sku,
			skuLine: sku
				? sub
					? sku
					: [sku, part.availability].filter(Boolean).join(" · ")
				: part.availability || "No matching part",
			qty,
			unit,
			unitCost,
			line,
			missing,
			unsure,
			sub,
			tone: sub ? "sub" : missing ? "miss" : unsure ? "unsure" : part.pin ? "" : "none",
			badge: sub
				? { label: "Substitute", tone: "success" }
				: missing
					? { label: "Not in inventory", tone: "danger" }
					: part.lowStock
						? { label: "Low stock", tone: "warning" }
						: null,
		};
	});

	const markup = (cost * result.markupPercent) / 100;
	const alwaysReview = !rules.directToQuote;
	return {
		rows,
		cost,
		markup,
		price: cost + markup,
		pending,
		reasons,
		alwaysReview,
		ready: !alwaysReview && reasons.length === 0,
	};
}

/**
 * The parts as procurement gets them. A substitute the requester picked replaces
 * the missing part; a missing part left as it is goes as "asked to add".
 */
export function partsForProcurement(result: DesignResult, choices: MissingChoices) {
	return result.parts.map((part) => {
		const sub =
			part.kind === "missing"
				? part.substitutes?.find((s) => s.id === choices[part.id])
				: undefined;
		const base = {
			name: part.name,
			use: part.use,
			confidence: part.confidence,
			note: part.note,
			pin: part.pin,
			doubt: part.doubt,
			suggestion: part.suggestion,
		};
		if (sub) {
			return {
				...base,
				name: sub.name,
				sku: sub.sku,
				qty: sub.qty,
				unitCost: sub.unitCost,
				kind: "stock" as const,
				note: `Substitute for ${part.name.toLowerCase()}. ${sub.why}`.trim(),
				askedToAdd: false,
				substitutes: [],
			};
		}
		return {
			...base,
			sku: part.sku,
			qty: part.qty,
			unitCost: part.unitCost,
			kind: part.kind,
			askedToAdd: part.kind === "missing",
			substitutes: (part.substitutes ?? []).map((s) => ({
				name: s.name,
				sku: s.sku,
				qty: s.qty,
				unitCost: s.unitCost,
				why: s.why,
			})),
		};
	});
}

/** "W 260 × D 95 × H 78 cm" from whichever measurements were given; empty when none were. */
export function sizeLabel(size: { width?: string; depth?: string; height?: string }) {
	const parts = (
		[
			["W", size.width],
			["D", size.depth],
			["H", size.height],
		] as const
	)
		.map(([letter, value]) => [letter, Number(value)] as const)
		.filter(([, n]) => Number.isFinite(n) && n > 0)
		.map(([letter, n]) => `${letter} ${n}`);
	return parts.length ? `${parts.join(" × ")} cm` : "";
}

/** Steps shown while the agent works. */
export const agentSteps = (photoCount: number) => [
	`Reading ${photoCount} photo${photoCount === 1 ? "" : "s"}`,
	"Spotting components",
	"Matching each one to inventory",
	"Estimating labour and price",
];
