"use client";

import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useRouter } from "next/navigation";
import { ExternalLink, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import {
	saveAiSettingsAction,
	testAiProviderAction,
} from "@/app/(dashboard)/(settings)/settings/agent/actions";
import { Button } from "@/components/common/buttons";
import { SegmentedControl } from "@/components/common/segmented-control";
import MainForm, { FormField } from "@/components/forms";
import type { FormFieldConfig } from "@/components/forms/types";
import {
	AI_LIMITS,
	AI_PROVIDERS,
	DEFAULT_AGENT_PROMPT,
	PROVIDER_INFO,
	VISION_MODELS,
	modelLabel,
	type AiProvider,
	type AiSettingsView,
} from "@/lib/aiProviders";
import { SaveRow, SettingsCard, lockFields } from "./settingsCard";
import StepUpDialog from "./stepUpDialog";

type ProviderValues = { model: string; baseUrl: string; apiKey: string; removeKey: boolean };

type Values = {
	defaultProvider: AiProvider;
	prompt: string;
	context: string;
	temperature: number;
	maxOutputTokens: string;
	providers: Record<AiProvider, ProviderValues>;
};

const valuesFrom = (view: AiSettingsView): Values => ({
	defaultProvider: view.defaultProvider,
	prompt: view.prompt,
	context: view.context,
	temperature: view.temperature,
	maxOutputTokens: String(view.maxOutputTokens),
	providers: Object.fromEntries(
		view.providers.map((p) => [
			p.provider,
			{ model: p.model, baseUrl: p.baseUrl, apiKey: "", removeKey: false },
		]),
	) as Record<AiProvider, ProviderValues>,
});

/**
 * Which AI runs the parts agent, its API keys and its instructions. MD and GM
 * change them, confirming every save with their password and a two-step code;
 * Accounting sees them read-only. Saved keys are never sent to the browser.
 */
export default function AiProviderPanel({
	view,
	canEdit,
	hasApp,
	hasEmail,
}: {
	view: AiSettingsView;
	canEdit: boolean;
	/** The viewer's two-step methods, for the confirm dialog. */
	hasApp: boolean;
	hasEmail: boolean;
}) {
	const router = useRouter();
	const readOnly = !canEdit;
	const form = useForm<Values>({ defaultValues: valuesFrom(view) });
	const [editing, setEditing] = useState<AiProvider>(view.defaultProvider);
	const [pending, setPending] = useState<Values | null>(null);
	const [testing, startTest] = useTransition();
	const providerValues = useWatch({ control: form.control, name: "providers" });

	const savedOf = (p: AiProvider) => view.providers.find((x) => x.provider === p)!;

	const field = (config: FormFieldConfig) => (
		<FormField
			key={config.name}
			field={readOnly ? { ...config, disabled: true } : config}
			register={form.register}
			control={form.control}
			getValues={form.getValues}
			setValue={form.setValue}
			errors={form.formState.errors}
			hideRequiredMark
		/>
	);

	const test = (p: AiProvider) => {
		const v = form.getValues(`providers.${p}`);
		startTest(async () => {
			const res = await testAiProviderAction({
				provider: p,
				model: v.model,
				baseUrl: v.baseUrl,
				apiKey: v.apiKey,
			});
			if (res.ok) {
				toast.success(
					`${PROVIDER_INFO[p].label} answered with ${v.apiKey ? "the key you typed" : "the saved key"}.`,
				);
			} else toast.error(res.message);
		});
	};

	const info = PROVIDER_INFO[editing];
	const saved = savedOf(editing);
	const typedKey = !!providerValues?.[editing]?.apiKey;

	const generalFields: FormFieldConfig[] = [
		{
			name: "defaultProvider",
			type: "radio",
			appearance: "cards",
			label: "Provider the parts agent uses",
			options: AI_PROVIDERS.map((p) => {
				const s = savedOf(p);
				return {
					value: p,
					label: PROVIDER_INFO[p].label,
					description: `${PROVIDER_INFO[p].company} · ${modelLabel(p, s.model)} · ${s.hasKey ? `key saved, ends in ${s.keyLast4}` : "no API key yet"}`,
				};
			}),
		},
	];

	const instructionFields: FormFieldConfig[] = [
		{
			name: "prompt",
			type: "textarea",
			label: "Prompt",
			rows: 10,
			description:
				"What the agent is and how careful it should be. The reply format is fixed by the app, so you don't need to describe it.",
			validation: {
				required: "Write the agent's prompt.",
				maxLength: { value: AI_LIMITS.prompt, message: "Too long." },
			},
		},
		{
			name: "context",
			type: "textarea",
			label: "Workshop context (optional)",
			rows: 6,
			placeholder:
				"e.g. We build sofa frames from kiln-dried hardwood. Seats use pocket springs unless the client asks for foam. Bouclé is ordered by the yard.",
			description:
				"House rules and habits the photos can't show: how you build, materials you prefer, what you never use.",
			validation: { maxLength: { value: AI_LIMITS.context, message: "Too long." } },
		},
		{
			name: "temperature",
			type: "range",
			label: "Temperature",
			min: AI_LIMITS.temperature.min,
			max: AI_LIMITS.temperature.max,
			step: 0.05,
			className: "max-w-130",
			formatValue: (v) => v.toFixed(2),
			description:
				"Lower gives steadier, repeatable parts lists. ChatGPT models (GPT-5 and GPT-6) ignore it.",
		},
		{
			name: "maxOutputTokens",
			type: "number",
			label: "Output limit (tokens)",
			inputMode: "numeric",
			min: AI_LIMITS.maxOutputTokens.min,
			max: AI_LIMITS.maxOutputTokens.max,
			className: "max-w-60",
			description: "Raise it if replies get cut off on large pieces.",
		},
	];

	return (
		<SettingsCard
			readOnly={readOnly}
			title="AI provider"
			description="The parts agent reads the client's photos with an AI model. Pick the provider, add its API key and set the instructions. Every save asks for your password and a two-step code."
		>
			{!view.canStoreKeys && (
				<div
					role="status"
					className="flex items-start gap-3 rounded-md border border-warning-line bg-warning-subtle p-3 text-body"
				>
					<TriangleAlert
						aria-hidden="true"
						className="mt-0.5 size-5 shrink-0 text-warning-fg"
					/>
					<span>
						The server can&apos;t store API keys yet. Whoever runs it needs to set{" "}
						<code>AI_KEYS_SECRET</code> (32 or more random characters) and restart it.
						Until then, saved keys can&apos;t be read and the agent stays off.
					</span>
				</div>
			)}

			<MainForm<Values>
				methods={form}
				fields={lockFields(generalFields, readOnly)}
				hideRequiredMarks
				requireValidToSubmit={false}
				onSubmit={(values) => setPending(values)}
				footerSlot={
					<>
						<section aria-labelledby="ai-keys" className="flex flex-col gap-4">
							<div className="flex flex-wrap items-center gap-3">
								<h3 id="ai-keys" className="flex-1 text-h3">
									Models and keys
								</h3>
								<SegmentedControl
									label="Provider to edit"
									options={AI_PROVIDERS.map((p) => ({
										value: p,
										label: PROVIDER_INFO[p].label,
									}))}
									value={editing}
									onChange={setEditing}
								/>
							</div>
							<div
								key={editing}
								className="flex flex-col gap-4 rounded-md border border-line p-4"
							>
								<p className="text-small text-fg-secondary">
									{info.label} by {info.company}.{" "}
									<a
										href={info.keysUrl}
										target="_blank"
										rel="noreferrer"
										className="inline-flex items-center gap-1"
									>
										Get an API key
										<ExternalLink aria-hidden="true" className="size-3.5" />
										<span className="sr-only">(opens in a new tab)</span>
									</a>
								</p>
								<div className="grid gap-4 md:grid-cols-2">
									{field({
										name: `providers.${editing}.model`,
										type: "select",
										label: "Model",
										options: VISION_MODELS[editing].map((m) => ({
											value: m.id,
											label: m.label,
										})),
										description: "Only models that can read photos are listed.",
									})}
									{field({
										name: `providers.${editing}.apiKey`,
										type: "password",
										label: "API key",
										autoComplete: "new-password",
										placeholder: saved.hasKey
											? `Saved, ends in ${saved.keyLast4}. Type to replace it.`
											: "Paste the key",
										description: "Stored encrypted. It's never shown again.",
									})}
								</div>
								{info.regions &&
									field({
										name: `providers.${editing}.baseUrl`,
										type: "select",
										label: "Region",
										options: info.regions,
										description: "Use the region your API key was made in.",
									})}
								{saved.hasKey &&
									field({
										name: `providers.${editing}.removeKey`,
										type: "checkbox",
										label: `Remove the saved ${info.label} key`,
										disabled: typedKey,
									})}
								<Button
									size="sm"
									className="self-start"
									disabled={readOnly || testing || (!saved.hasKey && !typedKey)}
									onClick={() => test(editing)}
								>
									{testing ? "Testing…" : "Test connection"}
								</Button>
							</div>
						</section>

						<section aria-labelledby="ai-instructions" className="flex flex-col gap-4">
							<div className="flex flex-wrap items-center gap-3">
								<h3 id="ai-instructions" className="flex-1 text-h3">
									Instructions
								</h3>
								{!readOnly && (
									<Button
										size="sm"
										onClick={() => {
											form.setValue("prompt", DEFAULT_AGENT_PROMPT, {
												shouldDirty: true,
											});
											toast.info(
												"Default prompt filled in. Save to keep it.",
											);
										}}
									>
										Use the default prompt
									</Button>
								)}
							</div>
							{instructionFields.map((f) => field(f))}
						</section>
					</>
				}
				renderFooter={() => (readOnly ? null : <SaveRow label="Save AI settings" />)}
			/>

			{pending && (
				<StepUpDialog
					title="Confirm it's you"
					description="AI settings hold paid API keys, so every change needs your password and a fresh two-step code."
					hasApp={hasApp}
					hasEmail={hasEmail}
					confirmLabel="Save AI settings"
					onClose={() => setPending(null)}
					onConfirm={async (proof) => {
						const res = await saveAiSettingsAction(
							{
								...pending,
								temperature: Number(pending.temperature),
								maxOutputTokens: Number(pending.maxOutputTokens),
							},
							proof,
						);
						if (res.ok) {
							setPending(null);
							toast.success("AI settings saved.");
							// Clear typed keys; the page reloads the saved state
							AI_PROVIDERS.forEach((p) => {
								form.setValue(`providers.${p}.apiKey`, "");
								form.setValue(`providers.${p}.removeKey`, false);
							});
							router.refresh();
						}
						return res;
					}}
				/>
			)}
		</SettingsCard>
	);
}
