"use client";

import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { FormField } from "@/components/forms";
import {
	NUMBERED_DOCUMENTS,
	nextNumber,
	type CompanySettings,
	type Numbering,
} from "@/lib/companySettings";
import { saveCompanySettings, useCompanySettings } from "@/lib/companySettingsStore";
import { RecentChanges, SaveRow, SettingsCard } from "./settingsCard";

/** Document numbering: each document's prefix, with what the next number will look like. */
export default function NumberingPanel({
	initial,
	userName,
	now,
	canEdit,
}: {
	initial: CompanySettings;
	userName: string;
	now: string;
	/** MD or GM. Accounting sees the settings read-only. */
	canEdit: boolean;
}) {
	const settings = useCompanySettings(initial);
	const readOnly = !canEdit;
	const form = useForm<Numbering>({ mode: "onTouched", defaultValues: settings.numbering });
	const { control, register, getValues, setValue, handleSubmit, formState } = form;
	const prefixes = useWatch({ control }) as Numbering;

	const save = (v: Numbering) => {
		const next = Object.fromEntries(
			Object.entries(v).map(([k, p]) => [k, p.trim().toUpperCase()]),
		) as Numbering;
		const changed = NUMBERED_DOCUMENTS.filter(
			(d) => next[d.key] !== settings.numbering[d.key],
		).map((d) => d.label.toLowerCase());
		saveCompanySettings(
			{ numbering: next },
			{
				by: userName,
				what: changed.length
					? `Changed the ${changed.join(", ")} prefix${changed.length > 1 ? "es" : ""}`
					: "Saved document numbering",
			},
		);
		toast.success("Numbering saved. Documents that already exist keep their numbers.");
	};

	return (
		<>
			<SettingsCard
				readOnly={readOnly}
				title="Document numbering"
				description="Numbers are the prefix, then the date and time the document was created. They can't be edited after a document exists."
			>
				<form noValidate onSubmit={handleSubmit(save)} className="flex flex-col gap-5">
					{NUMBERED_DOCUMENTS.map((d) => (
						<div
							key={d.key}
							className="grid items-start gap-4 sm:grid-cols-[minmax(140px,200px)_1fr]"
						>
							<FormField<Numbering>
								field={{
									name: d.key,
									id: `numbering-${d.key}`,
									type: "text",
									label: `${d.label} prefix`,
									autoComplete: "off",
									disabled: readOnly,
									validation: {
										required: `${d.label} prefix is required`,
										validate: {
											shape: (v: string) =>
												/^[A-Za-z0-9-]{1,12}-$/.test(v.trim()) ||
												"Letters, numbers and dashes, ending in a dash",
											unique: (v: string) =>
												NUMBERED_DOCUMENTS.filter(
													(o) =>
														o.key !== d.key &&
														getValues(o.key)?.trim().toUpperCase() ===
															v.trim().toUpperCase(),
												).length === 0 ||
												"Another document uses this prefix",
										},
									},
								}}
								register={register}
								control={control}
								getValues={getValues}
								setValue={setValue}
								errors={formState.errors}
								hideRequiredMark
							/>
							<div className="flex flex-col gap-2">
								<span className="text-overline font-bold tracking-[0.06em] text-fg-tertiary uppercase">
									Next number
								</span>
								<output
									htmlFor={`numbering-${d.key}`}
									className="rounded-md bg-subtle px-4 py-2 font-mono text-body text-fg"
								>
									{nextNumber(
										d.key,
										(prefixes[d.key] ?? "").trim().toUpperCase(),
										now,
									)}
								</output>
							</div>
						</div>
					))}
					{!readOnly && <SaveRow />}
				</form>
			</SettingsCard>

			<RecentChanges changes={settings.changes} now={now} />
		</>
	);
}
