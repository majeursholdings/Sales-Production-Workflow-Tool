"use client";

import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/common/buttons";
import MainForm, { FormField } from "@/components/forms";
import type { FormFieldConfig } from "@/components/forms/types";
import { DataTable, type ColumnDef } from "@/components/tables";
import {
	DEFAULT_TIERS,
	DISCOUNT_WHO,
	type CompanySettings,
	type GeneralDiscount,
	type TradeTier,
} from "@/lib/companySettings";
import { saveCompanySettings, useCompanySettings } from "@/lib/companySettingsStore";
import { pct, percentOf, percentRule } from "./rules";
import { RecentChanges, SaveRow, SettingsCard, lockFields } from "./settingsCard";

type TierValues = Record<string, string>;
type DiscountValues = { maxPercent: string; who: GeneralDiscount["who"] };
type TierRow = { id: string; name: string; index: number | null };

const minKey = (i: number) => `min:${i}`;
const pctKey = (i: number) => `pct:${i}`;
const naira = (n: number) => `₦${n.toLocaleString("en-NG")}`;
const tierValues = (tiers: TradeTier[]): TierValues =>
	Object.fromEntries(
		tiers.flatMap((t, i) => [
			[minKey(i), String(t.minSpend)],
			[pctKey(i), pct(t.discountPercent)],
		]),
	);

/** Trade program: spend tiers and their discounts, plus the general discount sales can give. */
export default function TradePanel({
	initial,
	userName,
	now,
	canEdit,
	clientCounts,
}: {
	initial: CompanySettings;
	userName: string;
	now: string;
	/** MD or GM. Accounting sees the settings read-only. */
	canEdit: boolean;
	/** Trade clients in each tier now, by tier name ("Starter" for below the first). */
	clientCounts: Record<string, number>;
}) {
	const settings = useCompanySettings(initial);
	const readOnly = !canEdit;
	const { tiers, generalDiscount } = settings;

	const tierForm = useForm<TierValues>({ mode: "onTouched", defaultValues: tierValues(tiers) });
	const discountForm = useForm<DiscountValues>({
		mode: "onTouched",
		defaultValues: { maxPercent: pct(generalDiscount.maxPercent), who: generalDiscount.who },
	});

	const tierField = (config: FormFieldConfig) => (
		<FormField<TierValues>
			field={{ ...config, id: `tier-${config.name}`, disabled: readOnly }}
			register={tierForm.register}
			control={tierForm.control}
			getValues={tierForm.getValues}
			setValue={tierForm.setValue}
			errors={tierForm.formState.errors}
			hideRequiredMark
		/>
	);

	const columns: ColumnDef<TierRow>[] = [
		{
			key: "tier",
			header: "Tier",
			cell: (r) => <strong className="text-fg">{r.name}</strong>,
		},
		{
			key: "min",
			header: "Paid in the last 365 days, at least",
			className: "min-w-56",
			cell: (r) =>
				r.index === null ? (
					"Below the first tier"
				) : (
					<span className="block max-w-56">
						{tierField({
							name: minKey(r.index),
							type: "amount",
							label: `${r.name} threshold`,
							hideLabel: true,
							currencySymbol: "₦",
							validation: {
								validate: (v: string, all: TierValues) => {
									const i = r.index as number;
									if (!(Number(v) > 0)) return "Enter an amount above ₦0";
									if (i > 0 && Number(v) <= Number(all[minKey(i - 1)]))
										return `Must be more than ${tiers[i - 1]?.name ?? "the tier above"}`;
									return true;
								},
							},
						})}
					</span>
				),
		},
		{
			key: "discount",
			header: "Discount",
			cell: (r) =>
				r.index === null ? (
					"No discount"
				) : (
					<span className="block max-w-28">
						{tierField({
							name: pctKey(r.index),
							type: "text",
							label: `${r.name} discount`,
							hideLabel: true,
							inputMode: "decimal",
							validation: {
								...percentRule(`${r.name} discount`, 0, 100),
								validate: (v: string, all: TierValues) => {
									const i = r.index as number;
									const n = percentOf(v);
									if (!Number.isFinite(n) || n < 0 || n > 100)
										return "Enter a percentage from 0 to 100";
									if (i > 0 && n <= percentOf(all[pctKey(i - 1)]))
										return "Must be more than the tier below";
									return true;
								},
							},
						})}
					</span>
				),
		},
		{
			key: "count",
			header: "Clients now",
			className: "text-end tabular",
			cell: (r) => clientCounts[r.name] ?? 0,
		},
	];

	const rows: TierRow[] = [
		{ id: "starter", name: "Starter", index: null },
		...tiers.map((t, i) => ({ id: t.name, name: t.name, index: i })),
	];

	const saveTiers = (v: TierValues) => {
		const next = tiers.map((t, i) => ({
			...t,
			minSpend: Number(v[minKey(i)]),
			discountPercent: percentOf(v[pctKey(i)]),
		}));
		saveCompanySettings(
			{ tiers: next },
			{
				by: userName,
				what: `Set trade tiers: ${next.map((t) => `${t.name} ${pct(t.discountPercent)} from ${naira(t.minSpend)}`).join(", ")}`,
			},
		);
		toast.success(
			"Trade tiers saved. Tiers are re-checked tonight; sent quotes keep their discount.",
		);
	};

	const discountFields: FormFieldConfig[] = [
		{
			name: "maxPercent",
			type: "text",
			label: "Most they can give",
			inputMode: "decimal",
			description: "Default 3% of the price before VAT.",
			validation: percentRule("Most they can give", 0, 100),
		},
		{
			name: "who",
			type: "select",
			label: "Who can give it",
			options: DISCOUNT_WHO,
			validation: { required: "Pick who can give it" },
		},
	];

	return (
		<>
			<SettingsCard
				readOnly={readOnly}
				title="Trade program tiers"
				description="A trade client's discount depends on what they've paid in the last 365 days, counted from the day they joined the program. The tier is re-checked every night, so it rises as they spend and drops if older spending falls out of the 365 days."
			>
				<form
					noValidate
					onSubmit={tierForm.handleSubmit(saveTiers)}
					className="flex flex-col gap-4"
				>
					<DataTable tableId="trade-tiers" columns={columns} rows={rows} />
					<p className="rounded-md bg-subtle p-3 text-small text-fg-secondary">
						Defaults:{" "}
						{DEFAULT_TIERS.map(
							(t) => `${pct(t.discountPercent)} from ${naira(t.minSpend)}`,
						).join(", ")}
						. Spending counts paid invoices before VAT. The discount applies to
						furniture lines before VAT on new quotes; quotes already sent keep their
						discount.
					</p>
					{!readOnly && (
						<SaveRow
							label="Save tiers"
							extra={
								<Button
									onClick={() => {
										tierForm.reset(tierValues(DEFAULT_TIERS));
										toast.info("Defaults filled in. Save tiers to keep them.");
									}}
								>
									Reset to defaults
								</Button>
							}
						/>
					)}
				</form>
			</SettingsCard>

			<SettingsCard
				readOnly={readOnly}
				title="General discount"
				description="Customer care and sales can add a discount at their discretion when building a quote, with a reason. It isn't available for trade program clients, who get their tier discount instead."
			>
				<MainForm<DiscountValues>
					methods={discountForm}
					fields={lockFields(discountFields, readOnly)}
					rowPairs={[["maxPercent", "who"]]}
					hideRequiredMarks
					requireValidToSubmit={false}
					onSubmit={(v) => {
						const max = percentOf(v.maxPercent);
						saveCompanySettings(
							{ generalDiscount: { maxPercent: max, who: v.who } },
							{
								by: userName,
								what: `Set the general discount to at most ${pct(max)} (${DISCOUNT_WHO.find((w) => w.value === v.who)?.label.toLowerCase()})`,
							},
						);
						toast.success("General discount saved. It applies to new quotes.");
					}}
					renderFooter={() => (readOnly ? null : <SaveRow label="Save" />)}
				/>
			</SettingsCard>

			<RecentChanges changes={settings.changes} now={now} />
		</>
	);
}
