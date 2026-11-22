import { Minus, Plus } from "lucide-react";
import { IconButton } from "@/components/tables";

/** A number with − and + buttons, for quantities and hours per piece. */
export default function QtyStepper({
	value,
	onChange,
	min = 1,
	decLabel,
	incLabel,
	unit,
}: {
	value: number;
	onChange: (value: number) => void;
	min?: number;
	decLabel: string;
	incLabel: string;
	/** Small text after the stepper, e.g. "pieces" or "hours". */
	unit?: string;
}) {
	return (
		<span className="inline-flex items-center gap-1">
			<IconButton
				aria-label={decLabel}
				disabled={value <= min}
				onClick={() => onChange(Math.max(min, value - 1))}
			>
				<Minus aria-hidden="true" />
			</IconButton>
			<span aria-live="polite" className="min-w-7 text-center font-bold text-fg tabular">
				{value}
			</span>
			<IconButton aria-label={incLabel} onClick={() => onChange(value + 1)}>
				<Plus aria-hidden="true" />
			</IconButton>
			{unit && <span className="ms-1 text-small text-fg-tertiary">{unit}</span>}
		</span>
	);
}
