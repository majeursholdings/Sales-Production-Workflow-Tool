import { formatNaira } from "@/lib/currency";
import {
	OVERHEAD_PER_LABOUR_HOUR,
	percent,
	CONTINGENCY,
	type TemplateCost,
} from "@/lib/furnitureTypes";

/** What one piece costs and sells for: parts, labour, machines, overhead, other costs, contingency and markup. */
export default function CostBreakdown({
	cost,
	category,
	markupRate,
}: {
	cost: TemplateCost;
	category: string;
	markupRate: number;
}) {
	return (
		<dl className="flex w-full max-w-sm flex-col gap-2 text-body">
			<Row label="Parts" value={cost.parts} />
			<Row label={`Labour (${cost.labourHours} hours)`} value={cost.labour} />
			<Row label={`Machines (${cost.machineHours} hours)`} value={cost.machines} />
			<Row
				label={`Workshop overhead (${cost.labourHours} h × ${formatNaira(OVERHEAD_PER_LABOUR_HOUR).replace(".00", "")})`}
				value={cost.overhead}
			/>
			<Row label="Other costs" value={cost.extras} />
			<Row label={`Contingency (${percent(CONTINGENCY)})`} value={cost.contingency} />
			<Row label="Standard cost" value={cost.standard} strong divider />
			<Row label={`${category} markup (${percent(markupRate)})`} value={cost.markup} />
			<div className="flex items-baseline justify-between gap-3 font-bold">
				<dt>Price per piece, before VAT</dt>
				<dd className="font-display text-total tabular">{formatNaira(cost.price)}</dd>
			</div>
		</dl>
	);
}

function Row({
	label,
	value,
	strong,
	divider,
}: {
	label: string;
	value: number;
	strong?: boolean;
	divider?: boolean;
}) {
	return (
		<div
			className={`flex justify-between gap-3 ${strong ? "font-bold" : ""} ${divider ? "border-t border-line pt-2" : ""}`}
		>
			<dt className={strong ? "" : "text-fg-secondary"}>{label}</dt>
			<dd className="tabular">{formatNaira(value)}</dd>
		</div>
	);
}
