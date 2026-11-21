"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/common/buttons";
import { Card } from "@/components/common/card";
import { controlClass } from "@/components/forms/input";
import { cn } from "@/lib/cn";
import { SOFA_HOURS, type OverheadInputs } from "@/lib/costRates";
import { wholeNaira } from "@/lib/quoteBuilder";
import { saveOverheadsAction } from "@/app/(dashboard)/cost-rates/actions";

const toNumber = (v: string) => Number(v.replace(/[^0-9.]/g, "")) || 0;
const show = (n: number) => n.toLocaleString("en-NG");

function Field({
	label,
	hint,
	value,
	onChange,
	disabled,
	inputMode = "decimal",
}: {
	label: string;
	hint: React.ReactNode;
	value: string;
	onChange?: (v: string) => void;
	disabled?: boolean;
	inputMode?: "decimal" | "numeric";
}) {
	return (
		<label className="flex min-w-0 flex-col gap-2">
			<span className="text-body font-bold">{label}</span>
			<input
				value={value}
				onChange={onChange ? (e) => onChange(e.target.value) : undefined}
				disabled={disabled}
				inputMode={inputMode}
				className={cn(controlClass, "h-10")}
			/>
			<small className="text-small text-fg-tertiary">{hint}</small>
		</label>
	);
}

/** Workshop overhead: the monthly costs and workshop hours, and the hourly rate they work out to. */
export default function OverheadEditor({ initial }: { initial: OverheadInputs }) {
	const [rent, setRent] = useState(show(initial.rent));
	const [power, setPower] = useState(show(initial.power));
	const [other, setOther] = useState(show(initial.other));
	const [hoursEach, setHoursEach] = useState(String(initial.hoursEach));
	const [saving, setSaving] = useState(false);

	const rentN = toNumber(rent);
	const powerN = toNumber(power);
	const otherN = toNumber(other);
	const monthly = rentN + powerN + otherN + initial.staffMonthly;
	const workshopHours = initial.productionCount * toNumber(hoursEach);
	const rate = workshopHours > 0 ? monthly / workshopHours : 0;

	const rows: [string, string][] = [
		["Rent", wholeNaira(rentN)],
		["Power and diesel", wholeNaira(powerN)],
		["Internet, security and cleaning", wholeNaira(otherN)],
		["Non-production team", wholeNaira(initial.staffMonthly)],
	];

	return (
		<>
			<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
				<Card className="gap-5">
					<h2>Monthly costs that aren&apos;t tied to one piece</h2>
					<div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
						<Field
							label="Rent (showroom and workshop)"
							hint="Per month"
							value={rent}
							onChange={setRent}
						/>
						<Field
							label="Power and diesel"
							hint="Per month, average of the last 3 months"
							value={power}
							onChange={setPower}
						/>
						<Field
							label="Internet, security and cleaning"
							hint="Per month"
							value={other}
							onChange={setOther}
						/>
						<Field
							label="Non-production team"
							hint={
								<>
									From <Link href="/staff">Staff</Link>: {initial.staffCount}{" "}
									people
								</>
							}
							value={wholeNaira(initial.staffMonthly)}
							disabled
						/>
					</div>
					<div className="h-px bg-line" />
					<h2>Workshop hours a month</h2>
					<div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-4">
						<Field
							label="Production team"
							hint={
								<>
									People, from <Link href="/staff">Staff</Link>
								</>
							}
							value={String(initial.productionCount)}
							disabled
						/>
						<Field
							label="Hours each a month"
							hint="8 hours a day, 5 days a week"
							value={hoursEach}
							onChange={setHoursEach}
							inputMode="numeric"
						/>
					</div>
				</Card>

				<aside
					aria-label="Workshop overhead per hour"
					className="flex min-w-0 flex-col gap-6"
				>
					<Card className="gap-4">
						<h2>Workshop overhead per hour</h2>
						<span
							aria-live="polite"
							className="font-display text-[32px] leading-none font-bold text-accent-fg tabular"
						>
							{wholeNaira(rate)}
						</span>
						<dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-body">
							{rows.map(([k, v]) => (
								<div key={k} className="contents">
									<dt className="text-fg-secondary">{k}</dt>
									<dd className="text-end tabular">{v}</dd>
								</div>
							))}
							<dt className="border-t border-line pt-1.5 font-bold">
								Monthly overhead
							</dt>
							<dd className="border-t border-line pt-1.5 text-end font-bold tabular">
								{wholeNaira(monthly)}
							</dd>
							<dt className="text-fg-secondary">÷ workshop hours</dt>
							<dd className="text-end tabular">
								{workshopHours.toLocaleString("en-NG")} h
							</dd>
						</dl>
						<p className="text-small text-fg-tertiary">
							Every production hour on a piece carries this much. A 3-seater sofa
							takes {SOFA_HOURS} hours, so it carries{" "}
							{wholeNaira(Math.round(rate) * SOFA_HOURS)}.
						</p>
					</Card>
				</aside>
			</div>

			<div className="flex flex-wrap items-center justify-end gap-3">
				<span className="text-small text-fg-tertiary">
					Changes apply to new quotes. Quotes already sent keep their prices.
				</span>
				<Button
					variant="primary"
					disabled={saving}
					onClick={async () => {
						setSaving(true);
						const result = await saveOverheadsAction({
							rent: rentN,
							power: powerN,
							other: otherN,
							hoursEach: toNumber(hoursEach),
						});
						setSaving(false);
						if (!result.ok) {
							toast.error(result.message);
							return;
						}
						toast.success(
							"Saved. New quotes use these rates from now on; quotes already sent keep theirs.",
						);
					}}
				>
					{saving ? "Saving…" : "Save overheads"}
				</Button>
			</div>
		</>
	);
}
