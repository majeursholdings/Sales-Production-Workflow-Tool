"use client";

import { useId, type ReactNode } from "react";
import dayjs from "dayjs";
import { Badge } from "@/components/common/badge";
import { Button } from "@/components/common/buttons";
import type { FormFieldConfig } from "@/components/forms/types";
import { Avatar, Card } from "@/components/common/card";
import type { SettingsChange } from "@/lib/companySettings";
import { initials } from "@/lib/costRequests";

/** One settings card: a heading, an optional line under it, then its form. */
export function SettingsCard({
	title,
	description,
	readOnly,
	children,
}: {
	title: string;
	description?: ReactNode;
	/** Shows "View only" beside the heading, e.g. for Accounting. */
	readOnly?: boolean;
	children: ReactNode;
}) {
	const id = useId();
	return (
		<Card aria-labelledby={id} className="gap-5">
			<div className="flex flex-col gap-1">
				<div className="flex flex-wrap items-center gap-3">
					<h2 id={id} className="flex-1">
						{title}
					</h2>
					{readOnly && <Badge>View only: MD or GM can change</Badge>}
				</div>
				{description && <p className="text-body text-fg-secondary">{description}</p>}
			</div>
			{children}
		</Card>
	);
}

/** Disables every field when the viewer can't change them. */
export const lockFields = (fields: FormFieldConfig[], readOnly: boolean): FormFieldConfig[] =>
	readOnly ? fields.map((f) => ({ ...f, disabled: true })) : fields;

/** The right-aligned save row under a settings form (MainForm's renderFooter). */
export function SaveRow({
	label = "Save changes",
	saving,
	extra,
}: {
	label?: string;
	saving?: boolean;
	/** e.g. a "Reset to defaults" button, before Save. */
	extra?: ReactNode;
}) {
	return (
		<div className="flex flex-wrap justify-end gap-3">
			{extra}
			<Button type="submit" variant="primary" disabled={saving}>
				{label}
			</Button>
		</div>
	);
}

/** Who changed which company setting, newest first. */
export function RecentChanges({ changes, now }: { changes: SettingsChange[]; now: string }) {
	const when = (iso: string) => {
		const t = dayjs(iso);
		return t.isSame(dayjs(now), "day") || t.isAfter(dayjs(now))
			? `Today, ${t.format("HH:mm")}`
			: t.format("D MMM YYYY");
	};
	return (
		<SettingsCard title="Recent changes">
			<ul className="flex flex-col gap-3">
				{changes.slice(0, 5).map((c) => (
					<li key={`${c.at}-${c.what}`} className="flex items-start gap-3 text-body">
						<Avatar initials={initials(c.by)} />
						<span className="flex-1">
							{c.what}
							<span className="block text-small text-fg-tertiary">
								{c.by} · {when(c.at)}
							</span>
						</span>
					</li>
				))}
			</ul>
		</SettingsCard>
	);
}
