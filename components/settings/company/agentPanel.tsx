"use client";

import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/common/buttons";
import MainForm from "@/components/forms";
import type { FormFieldConfig } from "@/components/forms/types";
import {
	DEFAULT_AGENT_RULES,
	agentRuleSummary,
	type AgentRules,
	type CompanySettings,
} from "@/lib/companySettings";
import { saveAgentRulesAction } from "@/app/(dashboard)/(settings)/settings/actions";
import { RecentChanges, SaveRow, SettingsCard, lockFields, useSettingsSave } from "./settingsCard";

const checkboxLabel = (title: string, hint: string) => (
	<span className="flex flex-col">
		<strong>{title}</strong>
		<span className="text-small text-fg-secondary">{hint}</span>
	</span>
);

const fields: FormFieldConfig[] = [
	{
		name: "threshold",
		type: "range",
		label: "Confidence needed to skip procurement",
		min: 50,
		max: 100,
		step: 1,
		formatValue: (v) => `${v}%`,
		className: "max-w-130",
		description: `The agent must be at least this sure of every part. Higher sends more designs to procurement; lower lets more go straight on quotes. Default ${DEFAULT_AGENT_RULES.threshold}%.`,
	},
	{
		name: "directToQuote",
		type: "checkbox",
		label: checkboxLabel(
			"Let fully matched designs go straight on the quote",
			"Turn off to have procurement check every custom design.",
		),
	},
	{
		name: "lowStockToProcurement",
		type: "checkbox",
		label: checkboxLabel(
			"Send to procurement when a part is low on stock",
			"Off: low stock shows as a warning on the line but doesn't stop it.",
		),
	},
	{
		name: "suggestSubstitutes",
		type: "checkbox",
		label: checkboxLabel(
			"Suggest in-stock substitutes for parts we don't stock",
			"Customer care can still choose to ask procurement to add the part instead.",
		),
	},
];

/** Custom design agent: when its parts list goes straight on the quote and when procurement checks it. */
export default function AgentPanel({
	settings,
	now,
	canEdit,
}: {
	settings: CompanySettings;
	now: string;
	/** MD or GM. Accounting sees the settings read-only. */
	canEdit: boolean;
}) {
	const readOnly = !canEdit;
	const { saving, save } = useSettingsSave();
	const form = useForm<AgentRules>({ defaultValues: settings.agent });
	const rules = useWatch({ control: form.control }) as AgentRules;

	return (
		<>
			<SettingsCard
				readOnly={readOnly}
				title="Custom design agent"
				description="When customer care builds a custom design from a photo, the parts agent picks the parts from inventory and says how sure it is about each one. These rules decide when its parts list goes straight on the quote and when procurement checks it first. They apply to every role."
			>
				<MainForm<AgentRules>
					methods={form}
					fields={lockFields(fields, readOnly)}
					hideRequiredMarks
					requireValidToSubmit={false}
					footerSlot={
						<p className="rounded-md bg-subtle p-3 text-small text-fg-secondary">
							{agentRuleSummary({ ...DEFAULT_AGENT_RULES, ...rules })}
						</p>
					}
					onSubmit={(v) => {
						const next = { ...v, threshold: Number(v.threshold) };
						save(
							() => saveAgentRulesAction(next),
							next.directToQuote
								? `Saved. New custom designs need the agent to be at least ${next.threshold}% sure of every part to skip procurement.`
								: "Saved. Every new custom design goes to procurement first.",
							() => form.reset(next),
						);
					}}
					renderFooter={() =>
						readOnly ? null : (
							<SaveRow
								label="Save rules"
								saving={saving}
								extra={
									<Button
										onClick={() => {
											form.reset(DEFAULT_AGENT_RULES);
											toast.info(
												"Defaults filled in. Save rules to keep them.",
											);
										}}
									>
										Reset to defaults
									</Button>
								}
							/>
						)
					}
				/>
			</SettingsCard>

			<RecentChanges changes={settings.changes} now={now} />
		</>
	);
}
