import { Minus, Plus } from "lucide-react";

/** A − value + control for a quantity or a number of hours. */
export default function Stepper({
	value,
	onChange,
	min = 0,
	decreaseLabel,
	increaseLabel,
}: {
	value: number;
	onChange: (value: number) => void;
	min?: number;
	decreaseLabel: string;
	increaseLabel: string;
}) {
	const button =
		"grid size-8 cursor-pointer place-items-center text-fg-secondary hover:bg-subtle hover:text-fg disabled:cursor-not-allowed disabled:text-fg-tertiary [&_svg]:size-4";
	return (
		<span className="inline-flex items-center overflow-hidden rounded-md border border-line-control bg-surface">
			<button
				type="button"
				aria-label={decreaseLabel}
				disabled={value <= min}
				onClick={() => onChange(value - 1)}
				className={button}
			>
				<Minus aria-hidden="true" />
			</button>
			<span
				aria-live="polite"
				className="min-w-8 px-1 text-center text-body font-bold tabular"
			>
				{value}
			</span>
			<button
				type="button"
				aria-label={increaseLabel}
				onClick={() => onChange(value + 1)}
				className={button}
			>
				<Plus aria-hidden="true" />
			</button>
		</span>
	);
}
