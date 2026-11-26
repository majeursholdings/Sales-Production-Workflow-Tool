"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/common/buttons";
import { Avatar } from "@/components/common/card";
import { Chip } from "@/components/common/badge";
import { Drawer } from "@/components/common/drawer";
import MainForm from "@/components/forms";
import type { FormFieldConfig } from "@/components/forms/types";
import {
	REDO_REASONS,
	STEP_NAMES,
	STEP_STATUS,
	fmtHours,
	parseHours,
	shortDate,
	stepFigures,
	type JobCard,
} from "@/lib/jobCards";

type SendBackValues = { reason: string; notes: string; hours: string };

export type SendBackDraft = { step: number; reason: string; hours: number };

const initials = (name: string) =>
	name
		.split(" ")
		.map((w) => w[0])
		.join("");

/** One step: time logged, machines used, and (for someone who can edit) log more time or send it back for redo. */
export default function StepDrawer({
	card,
	step,
	canEdit,
	onLog,
	onSendBack,
	onClose,
}: {
	card: JobCard;
	step: number;
	canEdit: boolean;
	onLog: () => void;
	onSendBack: (draft: SendBackDraft) => void | Promise<void>;
	onClose: () => void;
}) {
	const [sendingBack, setSendingBack] = useState(false);
	const methods = useForm<SendBackValues>({ mode: "onTouched" });

	const s = card.steps[step];
	const f = stepFigures(s);
	const name = STEP_NAMES[step];
	const status = STEP_STATUS[s.status];
	// Only work that has been started, and isn't the delivery itself, can be sent back
	const canSendBack = canEdit && (s.status === "done" || s.status === "active") && step < 5;

	const fields: FormFieldConfig[] = [
		{
			name: "reason",
			type: "select",
			label: "What's wrong",
			defaultValue: REDO_REASONS[0],
			options: REDO_REASONS.map((r) => ({ label: r, value: r })),
		},
		{
			name: "notes",
			type: "textarea",
			label: "Notes",
			placeholder:
				"e.g. Left arm frame loose at the back rail; found when starting upholstery",
			defaultValue: "",
			rows: 3,
		},
		{
			name: "hours",
			type: "text",
			label: "Extra hours expected",
			inputMode: "decimal",
			defaultValue: "3",
			className: "max-w-50",
			validation: {
				validate: (v: string) => parseHours(v) > 0 || "Enter the extra hours, e.g. 3",
			},
		},
	];

	return (
		<Drawer
			title={`${step + 1}. ${name}`}
			description={`${card.id} · ${card.client}`}
			onClose={onClose}
			footer={
				canEdit && !sendingBack ? (
					<>
						{canSendBack && (
							<Button onClick={() => setSendingBack(true)}>Send back for redo</Button>
						)}
						<span className="flex-1" />
						<Button variant="primary" disabled={card.closed} onClick={onLog}>
							Log time on this step
						</Button>
					</>
				) : undefined
			}
		>
			<dl className="grid grid-cols-3 overflow-hidden rounded-lg border border-line max-sm:grid-cols-1">
				{[
					{
						label: "Status",
						value: status.label,
						note: s.redos.length
							? `${s.redos.length} ${s.redos.length === 1 ? "redo" : "redos"}`
							: s.status === "blocked"
								? "Short parts"
								: "",
					},
					{
						label: "Hours",
						value: fmtHours(f.actual),
						note: `of ${fmtHours(s.plannedHours)} planned`,
					},
					{
						label: "Machine time",
						value: fmtHours(f.machineActual),
						note: `of ${fmtHours(f.machinePlanned)} planned`,
					},
				].map((x) => (
					<div
						key={x.label}
						className="flex min-w-0 flex-col gap-1 px-4 py-3 shadow-[-1px_0_0_var(--border-default),0_-1px_0_var(--border-default)]"
					>
						<dt className="text-small text-fg-secondary">{x.label}</dt>
						<dd className="font-display text-h3 tabular">{x.value}</dd>
						{x.note && <dd className="text-small text-fg-tertiary">{x.note}</dd>}
					</div>
				))}
			</dl>

			<section aria-labelledby="time-logged-title" className="flex flex-col gap-1">
				<h3 id="time-logged-title">Time logged</h3>
				{s.entries.length === 0 ? (
					<p className="text-body text-fg-secondary">Nothing logged on this step yet.</p>
				) : (
					<ul className="flex flex-col">
						{s.entries.map((e) => (
							<li
								key={e.id}
								className="flex items-start gap-3 border-t border-line py-3 first:border-t-0"
							>
								<Avatar initials={initials(e.who)} />
								<span className="flex min-w-0 flex-1 flex-col gap-0.5">
									<strong>{e.who}</strong>
									<span className="text-small text-fg-tertiary">
										{shortDate(e.date)} ·{" "}
										{e.machines.length
											? e.machines
													.map((m) => `${m.machine} ${fmtHours(m.hours)}`)
													.join(", ")
											: "No machines"}
									</span>
									{e.redoNote && (
										<span className="flex flex-col items-start gap-1">
											<Chip className="bg-warning-subtle text-warning-fg">
												Redo
											</Chip>
											<span className="text-small text-fg-secondary">
												{e.redoNote}
											</span>
										</span>
									)}
								</span>
								<strong className="tabular">{fmtHours(e.hours)}</strong>
							</li>
						))}
					</ul>
				)}
			</section>

			<section aria-labelledby="machines-used-title" className="flex flex-col gap-1">
				<h3 id="machines-used-title">Machines used</h3>
				{f.machineUses.length === 0 ? (
					<p className="text-body text-fg-secondary">No machines on this step.</p>
				) : (
					<ul className="flex flex-col">
						{f.machineUses.map((m) => (
							<li
								key={m.machineId}
								className="flex items-center gap-3 border-t border-line py-3 first:border-t-0"
							>
								<span className="min-w-0 flex-1 font-bold text-fg">
									{m.machine}
								</span>
								<span className="text-small text-fg-tertiary">
									{fmtHours(m.planned)} planned
								</span>
								<strong className="min-w-12 text-end tabular">
									{fmtHours(m.actual)}
								</strong>
							</li>
						))}
					</ul>
				)}
			</section>

			{sendingBack && (
				<div className="flex flex-col gap-3 rounded-md bg-accent-subtle p-4">
					<strong className="text-accent-fg">
						Send {name.toLowerCase()} back for redo
					</strong>
					<MainForm<SendBackValues>
						methods={methods}
						fields={fields}
						hideRequiredMarks
						requireValidToSubmit={false}
						onSubmit={(v) =>
							onSendBack({
								step,
								reason: v.notes?.trim()
									? `${v.reason}: ${v.notes.trim()}`
									: v.reason,
								hours: parseHours(v.hours),
							})
						}
						renderFooter={({ isLoading }) => (
							<div className="flex flex-wrap justify-end gap-3">
								<Button onClick={() => setSendingBack(false)}>Cancel</Button>
								<Button type="submit" variant="primary" disabled={isLoading}>
									Confirm send back
								</Button>
							</div>
						)}
					/>
				</div>
			)}
		</Drawer>
	);
}
