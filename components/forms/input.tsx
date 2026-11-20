import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type FieldProps = {
	label: string;
	hint?: ReactNode;
	error?: ReactNode;
	className?: string;
};

export const controlClass =
	"w-full rounded-md border border-line-control bg-surface px-3 text-fg " +
	"placeholder:text-fg-tertiary outline-none " +
	"focus:border-focus focus:ring-1 focus:ring-focus " +
	"disabled:cursor-not-allowed disabled:border-line disabled:bg-subtle disabled:text-fg-tertiary " +
	"aria-invalid:border-danger-fg aria-invalid:focus:ring-danger-fg";

function Field({
	id,
	label,
	hint,
	error,
	className,
	children,
}: FieldProps & { id: string; children: ReactNode }) {
	return (
		<div className={cn("flex min-w-0 flex-col gap-2", className)}>
			<label htmlFor={id} className="text-body font-bold">
				{label}
			</label>
			{children}
			{(error || hint) && (
				<small
					id={`${id}-msg`}
					className={cn("text-small", error ? "text-danger-fg" : "text-fg-tertiary")}
				>
					{error ?? hint}
				</small>
			)}
		</div>
	);
}

export function Input({
	label,
	hint,
	error,
	className,
	id,
	...props
}: FieldProps & ComponentProps<"input">) {
	const auto = useId();
	const fid = id ?? auto;
	return (
		<Field id={fid} label={label} hint={hint} error={error} className={className}>
			<input
				id={fid}
				aria-invalid={error ? true : undefined}
				aria-describedby={error || hint ? `${fid}-msg` : undefined}
				className={cn(controlClass, "h-10")}
				{...props}
			/>
		</Field>
	);
}

export function Select({
	label,
	hint,
	error,
	className,
	id,
	children,
	...props
}: FieldProps & ComponentProps<"select">) {
	const auto = useId();
	const fid = id ?? auto;
	return (
		<Field id={fid} label={label} hint={hint} error={error} className={className}>
			<select
				id={fid}
				aria-invalid={error ? true : undefined}
				aria-describedby={error || hint ? `${fid}-msg` : undefined}
				className={cn(controlClass, "h-10")}
				{...props}
			>
				{children}
			</select>
		</Field>
	);
}

export function Textarea({
	label,
	hint,
	error,
	className,
	id,
	...props
}: FieldProps & ComponentProps<"textarea">) {
	const auto = useId();
	const fid = id ?? auto;
	return (
		<Field id={fid} label={label} hint={hint} error={error} className={className}>
			<textarea
				id={fid}
				aria-invalid={error ? true : undefined}
				aria-describedby={error || hint ? `${fid}-msg` : undefined}
				className={cn(controlClass, "min-h-30 resize-y py-2")}
				{...props}
			/>
		</Field>
	);
}

/** Search box: icon + borderless input inside a bordered shell. */
export function SearchInput({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
	return (
		<div
			className={cn(
				"flex h-10 w-70 max-w-full items-center gap-2 rounded-md border border-line-control bg-surface px-3",
				"focus-within:border-focus focus-within:ring-1 focus-within:ring-focus",
				className,
			)}
		>
			<svg
				aria-hidden="true"
				viewBox="0 0 24 24"
				className="size-5 shrink-0 text-fg-tertiary"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
			>
				<circle cx="11" cy="11" r="7" />
				<path d="m20 20-3.5-3.5" />
			</svg>
			<input
				type="search"
				className="min-w-0 flex-1 bg-transparent text-fg outline-none placeholder:text-fg-tertiary"
				{...props}
			/>
		</div>
	);
}
