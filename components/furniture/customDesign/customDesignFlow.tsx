"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { Check, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { buildPartsListAction } from "@/app/(dashboard)/furniture-types/custom-design/actions";
import { createCostRequestAction } from "@/app/(dashboard)/cost-requests/actions";
import { Button, LinkButton } from "@/components/common/buttons";
import { Card } from "@/components/common/card";
import MainForm, { FormField } from "@/components/forms";
import type { FileFieldValue, SavedFile } from "@/components/forms/fileInput";
import type { FormFieldConfig } from "@/components/forms/types";
import type { AgentRules } from "@/lib/companySettings";
import {
	agentSteps,
	ASK_PROCUREMENT,
	assessDesign,
	partsForProcurement,
	sizeLabel,
	type DesignResult,
	type DesignScope,
} from "@/lib/customDesign";
import { useQuoteDraft } from "@/lib/quoteDraft";
import { MAX_PHOTOS_PER_UPLOAD } from "@/lib/storage";
import { resolveUploadedPhotos } from "@/lib/storageClient";
import AgentProgress from "./agentProgress";
import DesignResultView from "./designResult";
import SizeDiagram, { SIZE_INPUT_IDS } from "./sizeDiagram";

dayjs.extend(customParseFormat);

type Values = {
	scope: DesignScope;
	target: string;
	photos: FileFieldValue[] | null;
	description: string;
	/** Size in centimetres; each may be left blank. */
	width: string;
	depth: string;
	height: string;
	quantity: string;
	/** Part id → substitute id, or "ask", for parts that aren't in inventory. */
	choices: Record<string, string>;
};

type Phase =
	| { name: "upload" }
	| { name: "analysing"; images: { src: string; alt: string }[] }
	| { name: "result"; result: DesignResult }
	| { name: "sent"; result: DesignResult; requestId: string };

/** How long each "building" step shows before the next, while the agent works. */
const STEP_MS = 750;

/**
 * Custom design from a photo: upload the client's photos, the parts agent picks
 * parts from inventory, then the design goes on the quote or to procurement.
 */
export default function CustomDesignFlow({
	rules,
	targets,
	initialTarget,
	agentReady,
	canBuild,
}: {
	rules: AgentRules;
	/** Published furniture types an addition can be for. */
	targets: { id: string; name: string }[];
	/** Furniture type id to start on "an addition to", e.g. from a quote's item card. */
	initialTarget: string | null;
	agentReady: boolean;
	/** The viewer's role can create quotes. */
	canBuild: boolean;
}) {
	const draft = useQuoteDraft();
	const [phase, setPhase] = useState<Phase>({ name: "upload" });
	const [step, setStep] = useState(0);
	const [error, setError] = useState<string | null>(null);
	const [sending, startSending] = useTransition();

	const form = useForm<Values>({
		mode: "onTouched",
		defaultValues: {
			scope: initialTarget ? "addition" : "new",
			target: initialTarget ?? "",
			photos: [],
			description: "",
			width: "",
			depth: "",
			height: "",
			quantity: "1",
			choices: {},
		},
	});
	const scope = useWatch({ control: form.control, name: "scope" });
	const choices = useWatch({ control: form.control, name: "choices" }) ?? {};

	// Step timers and the run in progress; a cancelled run's answer is ignored.
	const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
	const run = useRef(0);
	const clearTimers = () => {
		timers.current.forEach(clearTimeout);
		timers.current = [];
	};
	const stopOnUnmount = useCallback(() => () => timers.current.forEach(clearTimeout), []);

	const quote = draft.client && draft.quoteNumber ? draft : null;
	const backHref = draft.client ? "/quotes/new/items" : "/furniture-types";
	const backLabel = draft.client ? "Back to quote" : "Back to furniture types";

	const restart = () => {
		run.current++;
		clearTimers();
		setPhase({ name: "upload" });
	};

	const build = async (values: Values) => {
		setError(null);
		const id = ++run.current;
		const uploaded = await resolveUploadedPhotos("cost-requests", values.photos);
		if (id !== run.current) return;
		if (!uploaded.ok) {
			setError(uploaded.message);
			return;
		}
		// keep the uploads as saved files, so going back to the form doesn't upload them again
		const names = (values.photos ?? []).map((p) => p.name ?? "");
		form.setValue(
			"photos",
			uploaded.urls.map((url, i): SavedFile => ({
				id: url,
				url,
				name: names[i] ?? `Photo ${i + 1}`,
				kind: "image",
			})),
		);
		const images = uploaded.urls.map((src, i) => ({
			src,
			alt: `Client's photo ${i + 1}${names[i] ? `: ${names[i]}` : ""}`,
		}));

		setStep(0);
		setPhase({ name: "analysing", images });
		clearTimers();
		for (let i = 1; i < agentSteps(images.length).length; i++) {
			timers.current.push(setTimeout(() => setStep(i), i * STEP_MS));
		}

		const result = await buildPartsListAction({
			scope: values.scope,
			targetId: values.scope === "addition" ? values.target || null : null,
			images,
			description: values.description,
			size: sizeLabel(values),
			quantity: Number(values.quantity) || 1,
		});
		if (id !== run.current) return;
		clearTimers();
		if (!result.ok) {
			setError(result.message);
			setPhase({ name: "upload" });
			return;
		}
		// a part that isn't in inventory starts on "ask procurement to add it"
		form.setValue(
			"choices",
			Object.fromEntries(
				result.data.parts
					.filter((p) => p.kind === "missing")
					.map((p) => [p.id, ASK_PROCUREMENT]),
			),
		);
		setPhase({ name: "result", result: result.data });
	};

	const send = (result: DesignResult) => {
		if (!quote?.client || !quote.quoteNumber) return;
		const validUntil = dayjs(quote.savedHeader?.validUntil, "D MMM YYYY");
		startSending(async () => {
			const res = await createCostRequestAction({
				title: result.title,
				target: result.target,
				newPiece: result.scope === "new",
				clientId: quote.client!.id,
				client: quote.client!.name,
				quote: quote.quoteNumber!,
				neededBy: (validUntil.isValid() ? validUntil : dayjs().add(7, "day")).format(
					"YYYY-MM-DD",
				),
				size: result.size,
				quantity: result.quantity,
				markupPercent: result.markupPercent,
				markupCategory: result.markupCategory,
				notes: result.description,
				images: result.images,
				parts: partsForProcurement(result, form.getValues("choices")),
			});
			if (!res.ok) {
				toast.error(res.message);
				return;
			}
			setPhase({ name: "sent", result, requestId: res.data.id });
		});
	};

	const renderField = (config: FormFieldConfig) => (
		<FormField
			key={config.name}
			field={config}
			register={form.register}
			control={form.control}
			getValues={form.getValues}
			setValue={form.setValue}
			errors={form.formState.errors}
			hideRequiredMark
		/>
	);

	// ─── Upload ──────────────────────────────────────────────────────────────

	const blocked = !canBuild
		? "Your role can't build custom designs. Ask someone in sales or customer care."
		: !agentReady
			? "The parts agent isn't set up yet: the MD or GM needs to choose an AI provider and add its API key in Settings › Custom design agent. You can fill this in, but Build parts list stays off until then."
			: null;

	const fields: FormFieldConfig[] = [
		{
			name: "scope",
			type: "radio",
			appearance: "cards",
			label: "What is it?",
			defaultValue: "new",
			options: [
				{
					value: "new",
					label: "A new piece",
					description: "Not one of our furniture types",
				},
				{
					value: "addition",
					label: "An addition to a piece",
					description: "Extra work on one of our furniture types",
				},
			],
		},
		...(scope === "addition"
			? [
					{
						name: "target",
						type: "combobox",
						label: "Which piece does it add to?",
						placeholder: "Search furniture types",
						emptyMessage: "No published furniture type matches",
						options: targets.map((t) => ({ value: t.id, label: t.name })),
						validation: { required: "Pick the piece this adds to." },
					} satisfies FormFieldConfig,
				]
			: []),
		{
			name: "photos",
			type: "image",
			label: "Photos of the design",
			multiple: true,
			maxFiles: MAX_PHOTOS_PER_UPLOAD,
			maxSizeMB: 10,
			description: `At least 1, up to ${MAX_PHOTOS_PER_UPLOAD} · JPG, PNG or HEIC, 10 MB each. A clear, front-on photo works best; add a close-up of any detail that matters, like a base, trim or stitching.`,
			validation: {
				validate: (v: unknown) =>
					(Array.isArray(v) && v.length > 0) ||
					"Add at least one photo. The agent builds the parts list from what it can see.",
			},
		},
		{
			name: "description",
			type: "textarea",
			label: "Describe it (optional)",
			rows: 4,
			description:
				"Mention anything the photo can't show: what's inside, the fabric the client wants, or what to change from the photo.",
			validation: { maxLength: { value: 2000, message: "Keep it under 2,000 characters." } },
		},
	];

	const dimension = (name: keyof typeof SIZE_INPUT_IDS, label: string): FormFieldConfig => ({
		name,
		id: SIZE_INPUT_IDS[name],
		type: "number",
		label: `${label} (cm)`,
		inputMode: "decimal",
		min: 1,
		step: 0.1,
		validation: {
			min: { value: 1, message: "Enter at least 1 cm." },
			max: { value: 2000, message: "That's over 20 m. Check the number." },
		},
	});

	// Size (three numbers beside a diagram) and quantity, after the fields MainForm lays out
	const sizeAndQuantity = (
		<>
			<fieldset className="group flex flex-col gap-3">
				<legend className="flex flex-wrap items-baseline gap-x-2 text-body font-bold">
					Size
					<span className="text-small font-normal text-fg-secondary">
						In centimetres, if known. Leave out any you don&apos;t have.
					</span>
				</legend>
				<div className="flex flex-wrap items-center gap-x-6 gap-y-3">
					<SizeDiagram className="max-w-60 flex-[1_1_200px]" />
					<div className="grid flex-[1_1_220px] grid-cols-3 gap-3 sm:grid-cols-1">
						{renderField(dimension("width", "Width"))}
						{renderField(dimension("depth", "Depth"))}
						{renderField(dimension("height", "Height"))}
					</div>
				</div>
			</fieldset>
			<div>
				{renderField({
					name: "quantity",
					type: "number",
					label: "Quantity",
					inputMode: "numeric",
					min: 1,
					step: 1,
					validation: {
						required: "Enter how many.",
						min: { value: 1, message: "At least 1." },
					},
				})}
			</div>
		</>
	);

	const header = (title: string, description: string) => (
		<div className="flex flex-col gap-1 border-b border-line px-5 py-4">
			<h2>{title}</h2>
			<p className="text-body text-fg-secondary">{description}</p>
		</div>
	);
	const footer = "flex flex-wrap items-center gap-3 border-t border-line px-5 py-4";

	if (phase.name === "upload") {
		return (
			<Card flush>
				{header(
					"Upload the client's photos",
					"The parts agent picks the parts from inventory and flags anything we don't stock.",
				)}
				<div className="flex max-w-160 flex-col gap-5 px-5 py-5">
					{blocked && (
						<div
							role="status"
							className="flex items-start gap-3 rounded-md border border-warning-line bg-warning-subtle p-3 text-body"
						>
							<TriangleAlert
								aria-hidden="true"
								className="mt-0.5 size-5 shrink-0 text-warning-fg"
							/>
							<span>{blocked}</span>
						</div>
					)}
					{error && (
						<div
							role="alert"
							className="flex items-start gap-3 rounded-md border border-danger-line bg-danger-subtle p-3 text-body"
						>
							<TriangleAlert
								aria-hidden="true"
								className="mt-0.5 size-5 shrink-0 text-danger-fg"
							/>
							<span>{error}</span>
						</div>
					)}
					<MainForm<Values>
						methods={form}
						fields={fields}
						footerSlot={sizeAndQuantity}
						hideRequiredMarks
						onSubmit={build}
						renderFooter={({ canSubmit }) => (
							<div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
								<p className="flex-[1_1_240px] text-small text-fg-secondary">
									You&apos;ll see what the agent found and why before anything
									goes on the quote.
								</p>
								<LinkButton href={backHref}>Cancel</LinkButton>
								<Button
									type="submit"
									variant="primary"
									disabled={
										!!blocked || !canSubmit || form.formState.isSubmitting
									}
								>
									{form.formState.isSubmitting
										? "Uploading photos…"
										: "Build parts list"}
								</Button>
							</div>
						)}
					/>
				</div>
			</Card>
		);
	}

	// ─── Building ────────────────────────────────────────────────────────────

	if (phase.name === "analysing") {
		return (
			<Card flush ref={stopOnUnmount}>
				{header(
					"Building the parts list",
					"The agent is reading the photos and matching parts to inventory.",
				)}
				<div className="px-5 py-5">
					<AgentProgress images={phase.images} step={step} />
				</div>
				<div className={footer}>
					<span className="flex-1" />
					<Button onClick={restart}>Cancel</Button>
				</div>
			</Card>
		);
	}

	// ─── Sent to procurement ─────────────────────────────────────────────────

	if (phase.name === "sent") {
		return (
			<Card flush>
				{header(phase.result.title, phase.result.target)}
				<div className="flex flex-col gap-4 px-5 py-5">
					<div
						role="status"
						className="flex items-start gap-3 rounded-md border border-success-line bg-success-subtle p-3 text-body"
					>
						<Check
							aria-hidden="true"
							className="mt-0.5 size-5 shrink-0 text-success-fg"
						/>
						<span className="flex flex-col gap-1">
							<b>Sent to procurement as {phase.requestId}</b>
							<span>
								They&apos;ll check the agent&apos;s parts list and price anything
								flagged. You&apos;ll get a notification when it&apos;s approved; the
								quote can&apos;t be sent until then.
							</span>
						</span>
					</div>
				</div>
				<div className={footer}>
					<span className="flex-1" />
					<Button
						onClick={() => {
							form.reset();
							restart();
						}}
					>
						Start another
					</Button>
					<LinkButton variant="primary" href={backHref}>
						{backLabel}
					</LinkButton>
				</div>
			</Card>
		);
	}

	// ─── The agent's parts list ──────────────────────────────────────────────

	const { result } = phase;
	const assessment = assessDesign(result, choices, rules);
	const sendNote = quote
		? null
		: "To send this to procurement, start it from a saved quote (Quotes › New quote › Items & parts, then Save draft).";

	return (
		<Card flush>
			{header(
				result.title,
				`${result.target}${result.size ? ` · ${result.size}` : ""} · quantity ${result.quantity}`,
			)}
			<div className="px-5 py-5">
				<DesignResultView
					result={result}
					assessment={assessment}
					rules={rules}
					renderField={renderField}
				/>
			</div>
			<div className={footer}>
				<p className="flex-[1_1_260px] text-small text-fg-secondary">
					{sendNote ??
						(assessment.ready
							? "Custom lines can't go on a quote yet, so send it to procurement to have it priced."
							: "The line shows “In review” on the quote, and the quote can't be sent until procurement approves it.")}
				</p>
				<Button onClick={restart}>Start over</Button>
				{assessment.ready && (
					<Button
						variant="primary"
						disabled
						title="Custom lines can't be saved on a quote yet"
					>
						{result.scope === "addition" && result.targetName
							? `Add to ${result.targetName}`
							: "Add to quote"}
					</Button>
				)}
				<Button
					variant={assessment.ready ? "secondary" : "primary"}
					disabled={!quote || sending}
					onClick={() => send(result)}
				>
					{sending ? "Sending…" : "Send to procurement"}
				</Button>
			</div>
		</Card>
	);
}
