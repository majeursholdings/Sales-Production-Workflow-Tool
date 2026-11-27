import { z } from "zod";
import { callModel, extractJson, type ModelImage } from "@/lib/ai/callModel";
import { fail, type ActionResult } from "@/lib/actionResult";
import { PROVIDER_INFO } from "@/lib/aiProviders";
import type { AgentRules } from "@/lib/companySettings";
import type { DesignPart, DesignResult, DesignScope } from "@/lib/customDesign";
import { getAiRuntime, type AiRuntime } from "@/lib/data/aiSettings";
import { getCompanyConfig } from "@/lib/data/companySettings";
import { getFurnitureCosting } from "@/lib/data/furnitureTypes";
import { getInventory } from "@/lib/data/procurement";
import type { FurnitureCategory, InventoryPart } from "@/lib/furnitureTypes";
import { availableOf } from "@/lib/inventory";
import { PROJECT_MEDIA_BUCKET, objectPathFromUrl, resolvePhotoType } from "@/lib/storage";
import { createClient } from "@/utils/supabase/server";

/** What the custom design page sends the parts agent. */
export type PartsAgentRequest = {
	scope: DesignScope;
	/** The furniture type it adds to, for an addition. */
	target: { id: string; name: string; categoryId: string } | null;
	/** Uploaded photos, as /api/storage/cost-requests/... URLs. */
	images: { src: string; alt: string }[];
	description: string;
	size: string;
	quantity: number;
};

// ─── Photos ──────────────────────────────────────────────────────────────────

/** Longest edge sent to the model: enough to read detail, small enough for every provider. */
const MAX_EDGE = 1568;
/** Under every provider's per-image limit once base64-encoded. */
const MAX_RAW_BYTES = 3.5 * 1024 * 1024;
const PASS_THROUGH = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

/** A JPEG no larger than MAX_EDGE, or the original when it can be sent as it is. */
async function prepareImage(
	bytes: Buffer,
	mime: string,
	rt: AiRuntime,
): Promise<ModelImage | null> {
	try {
		const sharp = (await import("sharp")).default;
		const out = await sharp(bytes)
			.rotate()
			.resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
			.jpeg({ quality: 82 })
			.toBuffer();
		return { mime: "image/jpeg", base64: out.toString("base64") };
	} catch {
		// No sharp, or a format it can't decode (most iPhone HEIC photos)
		const geminiHeic = rt.provider === "gemini" && /^image\/hei[cf]$/.test(mime);
		if ((PASS_THROUGH.has(mime) || geminiHeic) && bytes.length <= MAX_RAW_BYTES) {
			return { mime, base64: bytes.toString("base64") };
		}
		return null;
	}
}

async function loadImages(
	images: PartsAgentRequest["images"],
	rt: AiRuntime,
): Promise<ActionResult<ModelImage[]>> {
	const supabase = await createClient();
	const out: ModelImage[] = [];
	for (const [i, img] of images.entries()) {
		const path = objectPathFromUrl(img.src);
		if (!path) return fail(`Photo ${i + 1} isn't one of our uploads.`);
		const { data, error } = await supabase.storage.from(PROJECT_MEDIA_BUCKET).download(path);
		if (error || !data) return fail(`Couldn't open photo ${i + 1}. Upload it again.`);
		const mime = data.type || resolvePhotoType({ name: path, type: "" })?.mime || "";
		const prepared = await prepareImage(Buffer.from(await data.arrayBuffer()), mime, rt);
		if (!prepared) {
			return fail(
				`Photo ${i + 1} can't be read by ${PROVIDER_INFO[rt.provider].label}. Save it as a JPG or PNG under 3.5 MB and upload it again.`,
			);
		}
		out.push(prepared);
	}
	return { ok: true, data: out };
}

// ─── Instructions ────────────────────────────────────────────────────────────

/** The reply format. Fixed in code so the app can read it, whatever the prompt says. */
function outputContract(rules: AgentRules) {
	return `Reply with one JSON object and nothing else, in this shape:
{
  "title": "a short name for the piece, e.g. Curved channel-tufted sofa",
  "category": "one of the furniture categories given",
  "parts": [
    {
      "name": "what the part is",
      "sku": "an inventory SKU, or null when nothing in inventory fits",
      "unit": "the unit the quantity is in (the inventory's unit when sku is set)",
      "use": "what it's for, e.g. Frame, Upholstery, Seat, Base",
      "qty": 1,
      "confidence": 90,
      "pin": [50, 40],
      "doubt": null,
      "substitutes": []
    }
  ],
  "labour": [{ "role": "one of the labour roles given", "hours": 1 }],
  "machines": [{ "machine": "one of the machines given", "hours": 1 }],
  "labourConfidence": 80,
  "labourNote": "one sentence on how you estimated labour"
}
Rules for the JSON:
- confidence (0-100): how sure you are that the part and its quantity are right. Below ${rules.threshold}, a person checks it, so say why in "doubt"; otherwise "doubt" is null.
- pin: where the part is on photo 1, as percentages from its left and top edges (0-100). null when it can't be seen.
- substitutes: ${
		rules.suggestSubstitutes
			? `only for a part whose sku is null: up to 2 parts from the inventory list that could stand in, as { "sku", "qty", "why" }, where "why" says what changes. Otherwise [].`
			: "always []."
	}
- Labour and machine time go in "labour" and "machines", never in "parts". Hours are per piece.
- Use only the categories, labour roles, machines and SKUs given. Never invent a SKU.`;
}

const list = (items: string[]) => (items.length ? items.join(", ") : "none listed");

function userText(
	req: PartsAgentRequest,
	photoCount: number,
	inventory: InventoryPart[],
	categories: FurnitureCategory[],
	labourRoles: string[],
	machines: string[],
	targetCategory: string | null,
) {
	const piece =
		req.scope === "addition" && req.target
			? `An addition to our "${req.target.name}"${targetCategory ? ` (${targetCategory})` : ""}. List only the extra parts and labour the addition needs, not the ${req.target.name} itself.`
			: "A new piece, not one of our furniture types.";
	const stock = inventory
		.map((p) =>
			[p.sku, p.name, p.spec || "-", p.category, p.unit, `${p.available} available`].join(
				" | ",
			),
		)
		.join("\n");
	return `The piece: ${piece}
Quantity the client wants: ${req.quantity} (list parts and hours for one piece).
Size: ${req.size || "not given"}.
Description from customer care: ${req.description || "none"}.
Photos: ${photoCount} attached. Pins refer to photo 1.

Furniture categories: ${list(categories.map((c) => c.name))}
Labour roles: ${list(labourRoles)}
Machines: ${list(machines)}

Inventory (SKU | name | spec | category | unit | available):
${stock || "(empty)"}`;
}

// ─── Reading the reply ───────────────────────────────────────────────────────

const text = (max: number) => z.string().trim().max(max);
const hours = z.coerce.number().nonnegative();

const replySchema = z.object({
	title: text(120).min(1).catch("Custom piece"),
	category: text(120).catch(""),
	parts: z.array(z.unknown()).catch([]),
	labour: z.array(z.object({ role: z.string().trim(), hours })).catch([]),
	machines: z.array(z.object({ machine: z.string().trim(), hours })).catch([]),
	labourConfidence: z.coerce.number().catch(70),
	labourNote: text(400).catch(""),
});

const partSchema = z.object({
	name: text(160).min(1),
	sku: z.string().trim().nullish().catch(null),
	unit: text(40).nullish().catch(null),
	use: text(80).catch(""),
	qty: z.coerce.number().positive(),
	confidence: z.coerce.number().catch(50),
	pin: z.tuple([z.coerce.number(), z.coerce.number()]).nullish().catch(null),
	doubt: text(400).nullish().catch(null),
	substitutes: z
		.array(
			z.object({
				sku: z.string().trim(),
				qty: z.coerce.number().positive(),
				why: text(400).catch(""),
			}),
		)
		.catch([]),
});

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const pct = (n: number) => Math.round(clamp(n, 0, 100));
const lower = (s: string) => s.toLowerCase();

// ─── The agent ───────────────────────────────────────────────────────────────

/**
 * Reads the photos and notes, picks parts from inventory and estimates labour,
 * with whichever AI provider the MD or GM set as default. Every SKU, cost and
 * rate in the result comes from the database, never from the model.
 */
export async function runPartsAgent(req: PartsAgentRequest): Promise<ActionResult<DesignResult>> {
	const ai = await getAiRuntime();
	if (!ai.ok) return ai;
	const rt = ai.runtime;
	const label = PROVIDER_INFO[rt.provider].label;

	const [costing, config, stockLevels] = await Promise.all([
		getFurnitureCosting(),
		getCompanyConfig(),
		// Reorder levels, for "low stock"; roles that can't see inventory just don't get the flag
		getInventory().catch(() => null),
	]);
	const rules = config.agent;
	const { categories, inventory, rates } = costing;
	const targetCategory = req.target
		? (categories.find((c) => c.id === req.target!.categoryId) ?? null)
		: null;

	const photos = await loadImages(req.images, rt);
	if (!photos.ok) return photos;

	const reply = await callModel(rt, {
		system: [
			rt.prompt,
			outputContract(rules),
			rt.context.trim() ? `Workshop context from the MD or GM:\n${rt.context.trim()}` : "",
		]
			.filter(Boolean)
			.join("\n\n"),
		text: userText(
			req,
			photos.data.length,
			inventory,
			categories,
			Object.keys(rates.labourRates),
			Object.keys(rates.machineRates),
			targetCategory?.name ?? null,
		),
		images: photos.data,
		json: true,
	});
	if (!reply.ok) return reply;

	const parsed = replySchema.safeParse(extractJson(reply.text));
	if (!parsed.success) {
		return fail(`${label} answered, but not with a parts list the app can read. Try again.`);
	}
	const out = parsed.data;

	// Match everything to the database
	const bySku = new Map(inventory.map((p) => [lower(p.sku), p]));
	const reorder = new Map(
		(stockLevels?.parts ?? []).map((p) => [
			p.sku,
			{ level: p.reorderLevel, avail: availableOf(p) },
		]),
	);
	const isLow = (p: InventoryPart) => {
		const r = reorder.get(p.sku);
		return r ? r.avail <= r.level : p.available <= 0;
	};

	const parts: DesignPart[] = [];
	out.parts.forEach((raw) => {
		const p = partSchema.safeParse(raw);
		if (!p.success) return;
		const v = p.data;
		const id = `part-${parts.length + 1}`;
		const stocked = v.sku ? bySku.get(lower(v.sku)) : undefined;
		const confidence = pct(v.confidence);
		const pin: [number, number] | null = v.pin ? [pct(v.pin[0]), pct(v.pin[1])] : null;
		const doubt =
			v.doubt ||
			(v.sku && !stocked ? `The agent named ${v.sku}, which isn't in inventory.` : undefined);

		if (stocked) {
			parts.push({
				id,
				name: stocked.name,
				sku: stocked.sku,
				use: v.use,
				qty: v.qty,
				unit: stocked.unit,
				unitCost: stocked.unitCost,
				confidence,
				kind: "stock",
				pin,
				doubt: doubt ?? undefined,
				availability: `${Math.max(0, stocked.available)} ${stocked.unit} available`,
				lowStock: isLow(stocked),
			});
			return;
		}

		const substitutes = rules.suggestSubstitutes
			? v.substitutes.flatMap((s, j) => {
					const sub = bySku.get(lower(s.sku));
					return sub && j < 2
						? [
								{
									id: `${id}-s${j + 1}`,
									name: sub.name,
									sku: sub.sku,
									qty: s.qty,
									unitCost: sub.unitCost,
									why: `${s.why} ${sub.available} ${sub.unit} available.`.trim(),
									unit: sub.unit,
								},
							]
						: [];
				})
			: [];
		parts.push({
			id,
			name: v.name,
			sku: null,
			use: v.use,
			qty: v.qty,
			unit: v.unit || "piece",
			unitCost: 0,
			confidence,
			kind: "missing",
			pin,
			doubt: doubt ?? undefined,
			availability: "",
			lowStock: false,
			substitutes: substitutes.map((s) => ({
				id: s.id,
				name: s.name,
				sku: s.sku,
				qty: s.qty,
				unitCost: s.unitCost,
				why: s.why,
			})),
			substituteUnits: Object.fromEntries(substitutes.map((s) => [s.id, s.unit])),
		});
	});

	if (parts.length === 0) {
		return fail(
			`${label} couldn't find any parts it could match. Try a clearer, front-on photo or add a description.`,
		);
	}

	// Labour, machines and overhead, at today's rates from Staff, Machines and Cost rates
	const labourConfidence = pct(out.labourConfidence);
	const timeRows = (
		rows: { name: string; hours: number }[],
		table: Record<string, number>,
		use: string,
		note: string,
	) =>
		rows.flatMap((r): DesignPart[] => {
			const key = Object.keys(table).find((k) => lower(k) === lower(r.name));
			if (!key || r.hours <= 0) return [];
			const hours = Math.round(r.hours * 4) / 4;
			return [
				{
					id: `${use.toLowerCase()}-${lower(key).replace(/[^a-z0-9]+/g, "-")}`,
					name: key,
					sku: null,
					use,
					qty: hours,
					unit: hours === 1 ? "hour" : "hours",
					unitCost: table[key],
					confidence: labourConfidence,
					kind: "stock",
					pin: null,
					note,
					availability: note,
					lowStock: false,
				},
			];
		});
	const labour = timeRows(
		out.labour.map((l) => ({ name: l.role, hours: l.hours })),
		rates.labourRates,
		"Labour",
		"Staff rate",
	);
	const machines = timeRows(
		out.machines.map((m) => ({ name: m.machine, hours: m.hours })),
		rates.machineRates,
		"Machine",
		"Machine rate",
	);
	const labourHours = labour.reduce((sum, l) => sum + l.qty, 0);
	const overhead: DesignPart[] =
		labourHours > 0 && rates.overheadPerLabourHour > 0
			? [
					{
						id: "overhead",
						name: "Workshop overhead",
						sku: null,
						use: "Overhead",
						qty: labourHours,
						unit: "labour hours",
						unitCost: rates.overheadPerLabourHour,
						confidence: labourConfidence,
						kind: "stock",
						pin: null,
						note: "Cost rates",
						availability: "Cost rates",
						lowStock: false,
					},
				]
			: [];

	const category =
		targetCategory ?? categories.find((c) => lower(c.name) === lower(out.category)) ?? null;

	const result: DesignResult = {
		title: out.title,
		scope: req.scope,
		target: req.target ? `Addition to ${req.target.name}` : "New piece",
		targetName: req.target?.name ?? null,
		size: req.size,
		quantity: req.quantity,
		description: req.description,
		images: req.images,
		parts: [...parts, ...labour, ...machines, ...overhead],
		markupPercent: category ? Math.round(category.markup * 1000) / 10 : 0,
		markupCategory: category?.name ?? "",
		labourNote: [
			out.labourNote,
			`Built by ${label} (${rt.model}). Rates are today's, from Staff, Machines and Cost rates.`,
		]
			.filter(Boolean)
			.join(" "),
	};

	// Who ran the agent, on which model: for cost tracking
	const supabase = await createClient();
	const { data: auth } = await supabase.auth.getUser();
	await supabase.from("audit_logs").insert({
		actor_id: auth.user?.id ?? null,
		action: "custom_design.agent_run",
		entity_type: "custom_design",
		entity_id: req.target?.id ?? "new",
		new_values: {
			provider: rt.provider,
			model: rt.model,
			photos: photos.data.length,
			parts: result.parts.length,
		},
	});

	return { ok: true, data: result };
}

/** Sends a tiny request with the saved (or a just-typed) key, to check it works. */
export async function testAiProvider(rt: AiRuntime): Promise<ActionResult> {
	const reply = await callModel(rt, {
		system: "You are a connection test.",
		text: 'Reply with the JSON object {"ok": true}.',
		images: [],
		maxOutputTokens: 1024,
		timeoutMs: 30_000,
	});
	// A cut-off or empty reply still proves the key and model work
	return reply.ok || reply.code ? { ok: true } : reply;
}
