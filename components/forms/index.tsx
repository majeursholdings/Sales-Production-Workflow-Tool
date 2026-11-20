"use client";

import { useState, use, Suspense, useId, useMemo, type ReactNode } from "react";
import {
	useForm,
	Controller,
	Control,
	UseFormRegister,
	FieldValues,
	Path,
	PathValue,
	RegisterOptions,
	FieldErrors,
	useWatch,
	FormProvider,
	UseFormSetValue,
} from "react-hook-form";
import dayjs from "dayjs";
import {
	ChevronDown,
	EyeIcon,
	EyeOffIcon,
	TriangleAlert,
	Loader2,
	XIcon,
	Check,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/common/buttons";
import { controlClass } from "./input";
import { DEFAULT_CURRENCY_SYMBOL } from "@/lib/currency";
import { FormFieldConfig, MainFormProps, SelectOption } from "./types";
import { FileInput } from "./fileInput";

export default function MainForm<T extends FieldValues = FieldValues>({
	title,
	description,
	fields: fieldConfigs,
	onSubmit,
	submitLabel = "Submit",
	isLoading = false,
	className,
	rowPairs = [],
	footerSlot,
	methods,
	requireValidToSubmit = true,
	renderFooter,
	fieldGapClassName,
	hideRequiredMarks = false,
	layout = "stacked",
}: MainFormProps<T>) {
	// unique ids per form instance, so a form rendered twice never repeats an id
	const formId = useId();
	const fields = useMemo(
		() => fieldConfigs.map((f) => ({ ...f, id: f.id ?? `${formId}-${f.name}` })),
		[fieldConfigs, formId],
	);
	// Hooks must run unconditionally — when a shared `methods` instance is
	// passed in (e.g. steps of a wizard), this internal one is simply unused.
	const internalForm = useForm<T>({ mode: "onTouched" });
	const formMethods = methods ?? internalForm;
	const {
		register,
		handleSubmit,
		control,
		getValues,
		setValue,
		formState: { errors },
	} = formMethods;

	// Lets a parent read live field values (e.g. for a "preview" action) without
	// submitting — MainForm owns its own useForm() internally, so this is the way out.
	const watchedValues = useWatch({ control });

	const hasValue = (field: FormFieldConfig, value: unknown): boolean => {
		if (field.type === "checkbox") return value === true;
		if (field.type === "multiselect") return Array.isArray(value) && value.length > 0;
		return value !== undefined && value !== null && value !== "";
	};

	// checkbox/multiselect/radio fields are commonly validated with a `validate`
	// function rather than the `required` key — treat those as required too.
	const isFieldRequired = (field: FormFieldConfig): boolean =>
		!!field.validation?.required ||
		((field.type === "checkbox" || field.type === "multiselect" || field.type === "radio") &&
			!!field.validation);

	const canSubmit =
		!requireValidToSubmit ||
		fields
			.filter(isFieldRequired)
			.every((field) => hasValue(field, watchedValues?.[field.name]));

	const renderedPairs = new Set<string>();

	const renderField = (field: FormFieldConfig) => (
		<FormField
			key={field.name}
			field={field}
			register={register}
			control={control}
			getValues={getValues}
			setValue={setValue}
			errors={errors}
			hideRequiredMark={hideRequiredMarks}
		/>
	);

	return (
		<FormProvider {...formMethods}>
			<form
				onSubmit={handleSubmit(async (values) => {
					await onSubmit(values);
				})}
				className={cn(
					"flex flex-col gap-5",
					layout === "inline" && "flex-row items-start gap-0",
					className,
				)}
				noValidate
			>
				{(title || description) && (
					<div className="flex flex-col gap-1">
						{title && <h3 className="text-h3">{title}</h3>}
						{description && (
							<p className="text-body text-fg-secondary">{description}</p>
						)}
					</div>
				)}

				<div
					className={cn(
						"flex flex-col gap-4",
						layout === "inline" && "min-w-0 flex-1",
						fieldGapClassName,
					)}
				>
					{fields.map((field) => {
						const pair = rowPairs.find((p) => p.includes(field.name));
						if (!pair) return renderField(field);

						if (renderedPairs.has(pair[0])) return null;
						renderedPairs.add(pair[0]);

						const first = fields.find((f) => f.name === pair[0]);
						const second = fields.find((f) => f.name === pair[1]);
						if (!first || !second) return null;

						return (
							<div
								key={pair.join("-")}
								className={cn("flex flex-col gap-4 md:flex-row", fieldGapClassName)}
							>
								{renderField(first)}
								{renderField(second)}
							</div>
						);
					})}
				</div>

				{typeof footerSlot === "function" ? footerSlot(watchedValues) : footerSlot}

				{renderFooter ? (
					renderFooter({ isLoading, canSubmit })
				) : (
					<Button
						type="submit"
						variant="primary"
						disabled={isLoading || !canSubmit}
						// keep focus in the field on press: its blur would re-validate, shift the layout and make the click miss
						onMouseDown={(e) => e.preventDefault()}
						className="w-full"
					>
						{isLoading ? (
							<>
								<LoadingSpinner />
								{submitLabel}…
							</>
						) : (
							submitLabel
						)}
					</Button>
				)}
			</form>
		</FormProvider>
	);
}

// ─── Field router ─────────────────────────────────────────────────────────────

export type FormFieldProps<T extends FieldValues = FieldValues> = {
	field: FormFieldConfig;
	register: UseFormRegister<T>;
	control: Control<T>;
	getValues: () => T;
	setValue?: UseFormSetValue<T>;
	errors: FieldErrors<T>;
	/** Leave the asterisk off the label even if the field is required. */
	hideRequiredMark?: boolean;
};

export const FormField = <T extends FieldValues = FieldValues>({
	field,
	register,
	control,
	getValues,
	setValue,
	errors,
	hideRequiredMark = false,
}: FormFieldProps<T>) => {
	const error = errors[field.name as Path<T>]?.message as string | undefined;
	const fieldId = field.id ?? field.name;

	const wrapper = (children: ReactNode) => {
		if (field.type === "checkbox") {
			return (
				<div className={cn("flex min-w-0 flex-1 flex-col gap-2", field.className)}>
					<div className="flex items-center justify-between gap-3">
						{children}
						{field.trailingSlot}
					</div>
					{error && <FieldError id={`${fieldId}-msg`}>{error}</FieldError>}
				</div>
			);
		}

		return (
			<div className={cn("flex min-w-0 flex-1 flex-col gap-2", field.className)}>
				{field.label && (
					<label htmlFor={fieldId} className="text-body font-bold">
						{field.label}
						{field.validation?.required && !hideRequiredMark && (
							<span aria-hidden="true" className="ml-1 text-danger-fg">
								*
							</span>
						)}
					</label>
				)}
				{children}
				{/* File/image uploads show their description inside the drop zone */}
				{field.description && !error && field.type !== "file" && field.type !== "image" && (
					<small id={`${fieldId}-msg`} className="text-small text-fg-tertiary">
						{field.description}
					</small>
				)}
				{error && <FieldError id={`${fieldId}-msg`}>{error}</FieldError>}
			</div>
		);
	};

	switch (field.type) {
		case "password":
			return wrapper(<PasswordInput field={field} register={register} error={error} />);
		case "date":
			return wrapper(<DateInput field={field} control={control} error={error} />);
		case "datetime":
			return wrapper(<DateTimeInput field={field} control={control} error={error} />);
		case "select":
			return wrapper(<SelectInput field={field} control={control} error={error} />);
		case "combobox":
			return wrapper(<ComboboxSelectInput field={field} control={control} error={error} />);
		case "multiselect":
			return wrapper(<MultiSelectInput field={field} control={control} error={error} />);
		case "radio":
			return wrapper(<RadioInput field={field} control={control} error={error} />);
		case "textarea":
			return wrapper(
				<TextareaInput field={field} register={register} control={control} error={error} />,
			);
		case "file":
		case "image":
			return wrapper(
				<FileInput
					field={field}
					register={register}
					error={error}
					getValues={getValues}
					setValue={setValue}
				/>,
			);
		case "checkbox":
			return wrapper(<CheckboxInput field={field} control={control} error={error} />);
		case "number-dollar":
			return wrapper(<DollarInput field={field} register={register} error={error} />);
		case "amount":
			return wrapper(<AmountInput field={field} control={control} error={error} />);
		default:
			return wrapper(<TextInput field={field} register={register} error={error} />);
	}
};

// ─── Shared bits ──────────────────────────────────────────────────────────────

export type InputProps<T extends FieldValues = FieldValues> = {
	field: FormFieldConfig;
	register: UseFormRegister<T>;
	error?: string;
};

export type ControllerProps<T extends FieldValues = FieldValues> = {
	field: FormFieldConfig;
	control: Control<T>;
	error?: string;
	onValueChange?: (value: string) => void;
};

/** Text-field look from the design system (shared with the standalone Input). */
export const inputClass = (error?: string) => cn(controlClass, "h-10", error && "border-danger-fg");

/** aria wiring so the message under a field is announced with it. */
const describedBy = (field: FormFieldConfig, error?: string) =>
	error || field.description ? `${field.id ?? field.name}-msg` : undefined;

const FieldError = ({ id, children }: { id?: string; children: ReactNode }) => (
	<small id={id} role="alert" className="flex items-center gap-1 text-small text-danger-fg">
		<ErrorIcon />
		{children}
	</small>
);

const OptionsSkeleton = () => (
	<div aria-busy="true" className="h-10 w-full animate-pulse rounded-md bg-subtle" />
);

/** Floating list used by combobox and multiselect. */
const panelClass =
	"absolute top-full left-0 z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-line bg-surface p-1 " +
	"shadow-[0_8px_24px_rgb(33_29_26/0.15)]";

const optionClass =
	"flex min-h-9 cursor-pointer items-center gap-2 rounded-sm px-2 text-body select-none";

// ─── Text / email / tel / number ──────────────────────────────────────────────

export const TextInput = <T extends FieldValues = FieldValues>({
	field,
	register,
	error,
}: InputProps<T>) => {
	const hasIcon = !!field.icon;

	return (
		<div className="relative flex items-center">
			{hasIcon && (
				<span className="pointer-events-none absolute left-3 text-fg-tertiary [&_svg]:size-4">
					{field.icon}
				</span>
			)}
			<input
				id={field.id ?? field.name}
				type={field.type}
				placeholder={field.placeholder}
				// a field without a visible label (search bar) is named by its placeholder
				aria-label={field.label ? undefined : field.placeholder}
				aria-invalid={!!error || undefined}
				aria-describedby={describedBy(field, error)}
				autoFocus={field.autoFocus}
				autoComplete={field.autoComplete}
				inputMode={field.inputMode}
				maxLength={field.maxLength}
				readOnly={field.readOnly}
				disabled={field.disabled}
				min={field.min}
				max={field.max}
				step={field.step}
				defaultValue={field.defaultValue as string}
				className={cn(
					inputClass(error),
					hasIcon && "pl-9",
					field.readOnly && "cursor-default bg-subtle focus:ring-0",
				)}
				{...field.inputProps}
				{...register(
					field.name as Path<T>,
					field.validation as RegisterOptions<T, Path<T>>,
				)}
			/>
		</div>
	);
};

// Password — eye toggle trailing
const PasswordInput = <T extends FieldValues = FieldValues>({
	field,
	register,
	error,
}: InputProps<T>) => {
	const [show, setShow] = useState(false);

	return (
		<div className="relative flex items-center">
			<input
				id={field.id ?? field.name}
				type={show ? "text" : "password"}
				placeholder={field.placeholder ?? "Enter password"}
				autoComplete={field.autoComplete ?? "current-password"}
				disabled={field.disabled}
				aria-invalid={!!error || undefined}
				aria-describedby={describedBy(field, error)}
				className={cn(inputClass(error), "pr-10")}
				{...register(
					field.name as Path<T>,
					field.validation as RegisterOptions<T, Path<T>>,
				)}
			/>
			<button
				type="button"
				onClick={() => setShow((prev) => !prev)}
				className="absolute right-1 grid size-8 cursor-pointer place-items-center rounded-md text-fg-tertiary transition-colors hover:bg-subtle hover:text-fg"
				aria-label={show ? "Hide password" : "Show password"}
			>
				{show ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
			</button>
		</div>
	);
};

// Textarea — shows a character counter when the field's validation sets a
// minLength and/or maxLength rule (plain number or { value, message }).
const lengthRuleValue = (rule: unknown): number | undefined => {
	if (typeof rule === "number") return rule;
	if (rule && typeof rule === "object" && "value" in rule) {
		const value = Number(rule.value);
		return Number.isFinite(value) ? value : undefined;
	}
	return undefined;
};

export type TextareaInputProps<T extends FieldValues = FieldValues> = InputProps<T> & {
	control: Control<T>;
};

export const TextareaInput = <T extends FieldValues = FieldValues>({
	field,
	register,
	control,
	error,
}: TextareaInputProps<T>) => {
	const value = useWatch({ control, name: field.name as Path<T> });
	const minLength = lengthRuleValue(field.validation?.minLength);
	const maxLength = lengthRuleValue(field.validation?.maxLength);
	const showCounter = minLength !== undefined || maxLength !== undefined;
	const count = typeof value === "string" ? value.length : 0;
	const isOutOfRange =
		(maxLength !== undefined && count > maxLength) ||
		(minLength !== undefined && count > 0 && count < minLength);

	return (
		<div className="flex flex-col gap-2">
			<textarea
				id={field.id ?? field.name}
				placeholder={field.placeholder}
				disabled={field.disabled}
				readOnly={field.readOnly}
				rows={field.rows ?? 5}
				aria-invalid={!!error || undefined}
				aria-describedby={describedBy(field, error)}
				style={field.height ? { height: `${field.height}px` } : undefined}
				className={cn(controlClass, "resize-y py-2", error && "border-danger-fg")}
				{...register(
					field.name as Path<T>,
					field.validation as RegisterOptions<T, Path<T>>,
				)}
			/>
			{showCounter && (
				<div className="flex items-center justify-between gap-3 text-small text-fg-tertiary">
					<span>{minLength !== undefined && `Minimum ${minLength} characters`}</span>
					<span
						aria-live="polite"
						className={cn("tabular", isOutOfRange && "text-danger-fg")}
					>
						{maxLength !== undefined ? `${count} of ${maxLength}` : count}
					</span>
				</div>
			)}
		</div>
	);
};

// ─── Select ───────────────────────────────────────────────────────────────────

type NativeSelectProps = {
	field: FormFieldConfig;
	options: SelectOption[];
	value: string;
	onChange: (value: string) => void;
	onBlur?: () => void;
	selectRef?: React.Ref<HTMLSelectElement>;
	error?: string;
};

const NativeSelect = ({
	field,
	options,
	value,
	onChange,
	onBlur,
	selectRef,
	error,
}: NativeSelectProps) => {
	const canClear = !!field.clearable && !!value && !field.disabled;

	return (
		<div className="relative">
			<select
				id={field.id ?? field.name}
				ref={selectRef}
				value={value ?? ""}
				disabled={field.disabled}
				aria-invalid={!!error || undefined}
				aria-describedby={describedBy(field, error)}
				onChange={(e) => onChange(e.target.value)}
				onBlur={onBlur}
				className={cn(
					inputClass(error),
					"cursor-pointer",
					!value && "text-fg-tertiary",
					canClear && "pr-14",
				)}
			>
				<option value="">{field.placeholder ?? "Select an option"}</option>
				{options.map((opt) => (
					<option key={opt.value} value={opt.value} className="text-fg">
						{opt.label}
					</option>
				))}
			</select>
			{/* Beside the select, not in it */}
			{canClear && (
				<button
					type="button"
					onClick={() => onChange("")}
					aria-label="Clear selection"
					className="absolute top-1/2 right-8 grid size-6 -translate-y-1/2 cursor-pointer place-items-center rounded-full text-fg-tertiary transition-colors hover:bg-subtle hover:text-fg"
				>
					<XIcon className="size-3.5" />
				</button>
			)}
		</div>
	);
};

const selectRules = <T extends FieldValues>(field: FormFieldConfig) =>
	field.validation as RegisterOptions<T, Path<T>>;

const SelectControl = <T extends FieldValues = FieldValues>({
	field,
	control,
	error,
	onValueChange,
	options,
}: ControllerProps<T> & { options: SelectOption[] }) => (
	<Controller
		name={field.name as Path<T>}
		control={control}
		defaultValue={(field.defaultValue ?? "") as PathValue<T, Path<T>>}
		rules={selectRules<T>(field)}
		render={({ field: ctrl }) => (
			<NativeSelect
				field={field}
				options={options}
				value={ctrl.value}
				selectRef={ctrl.ref}
				onBlur={ctrl.onBlur}
				error={error}
				onChange={(val) => {
					ctrl.onChange(val);
					onValueChange?.(val);
				}}
			/>
		)}
	/>
);

export const AsyncSelectInput = <T extends FieldValues = FieldValues>(
	props: ControllerProps<T>,
) => {
	// useMemo keeps the promise stable across re-renders as long as
	// field.loadOptions keeps the same reference
	const { loadOptions } = props.field;
	const optionsPromise = useMemo(() => loadOptions!(), [loadOptions]);
	return <SelectControl {...props} options={use(optionsPromise)} />;
};

export const SelectInput = <T extends FieldValues = FieldValues>(props: ControllerProps<T>) => {
	if (props.field.loadOptions) {
		return (
			<Suspense fallback={<OptionsSkeleton />}>
				<AsyncSelectInput {...props} />
			</Suspense>
		);
	}
	return <SelectControl {...props} options={props.field.options ?? []} />;
};

// ─── Combobox ─────────────────────────────────────────────────────────────────
// A select you can type into to filter its options, for long lists. The form
// value is the chosen option's `value`, like SelectInput.

type ComboboxBoxProps = {
	field: FormFieldConfig;
	options: SelectOption[];
	value: string;
	onChange: (value: string) => void;
	onBlur: () => void;
	inputRef: React.Ref<HTMLInputElement>;
	error?: string;
};

const ComboboxBox = ({
	field,
	options,
	value,
	onChange,
	onBlur,
	inputRef,
	error,
}: ComboboxBoxProps) => {
	const listId = useId();
	const [query, setQuery] = useState<string | null>(null); // null → show the chosen label
	const [open, setOpen] = useState(false);
	const [active, setActive] = useState(0);

	const selected = options.find((opt) => opt.value === value);
	const text = query ?? selected?.label ?? "";
	const filtered = query
		? options.filter((opt) => opt.label.toLowerCase().includes(query.toLowerCase()))
		: options;

	const pick = (opt: SelectOption) => {
		onChange(opt.value);
		setQuery(null);
		setOpen(false);
	};

	return (
		<div
			className="relative"
			// focus left the whole widget (input and list)
			onBlur={(e) => {
				if (e.currentTarget.contains(e.relatedTarget)) return;
				setOpen(false);
				setQuery(null);
				onBlur();
			}}
		>
			<input
				id={field.id ?? field.name}
				ref={inputRef}
				role="combobox"
				aria-expanded={open}
				aria-controls={listId}
				aria-autocomplete="list"
				aria-activedescendant={open && filtered[active] ? `${listId}-${active}` : undefined}
				aria-invalid={!!error || undefined}
				aria-describedby={describedBy(field, error)}
				autoComplete="off"
				disabled={field.disabled}
				placeholder={field.placeholder ?? "Search"}
				value={text}
				onChange={(e) => {
					setQuery(e.target.value);
					setActive(0);
					setOpen(true);
				}}
				onFocus={() => setOpen(true)}
				onKeyDown={(e) => {
					if (e.key === "ArrowDown") {
						e.preventDefault();
						setOpen(true);
						setActive((i) => Math.min(filtered.length - 1, i + 1));
					} else if (e.key === "ArrowUp") {
						e.preventDefault();
						setActive((i) => Math.max(0, i - 1));
					} else if (e.key === "Enter" && open && filtered[active]) {
						e.preventDefault();
						pick(filtered[active]);
					} else if (e.key === "Escape") {
						setOpen(false);
						setQuery(null);
					}
				}}
				className={cn(inputClass(error), "pr-9")}
			/>
			<ChevronDown
				aria-hidden="true"
				className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-fg-tertiary"
			/>
			{open && !field.disabled && (
				<ul id={listId} role="listbox" className={panelClass}>
					{filtered.length === 0 && (
						<li className="px-2 py-2 text-body text-fg-tertiary">
							{field.emptyMessage ?? "No results found"}
						</li>
					)}
					{filtered.map((opt, i) => (
						<li
							key={opt.value}
							id={`${listId}-${i}`}
							role="option"
							aria-selected={opt.value === value}
							// keep focus in the input while choosing
							onMouseDown={(e) => e.preventDefault()}
							onMouseEnter={() => setActive(i)}
							onClick={() => pick(opt)}
							className={cn(
								optionClass,
								i === active && "bg-subtle",
								opt.value === value && "font-bold",
							)}
						>
							<span className="min-w-0 flex-1 truncate">{opt.label}</span>
							{opt.value === value && (
								<Check className="size-4 shrink-0 text-accent-fg" />
							)}
						</li>
					))}
				</ul>
			)}
		</div>
	);
};

const ComboboxControl = <T extends FieldValues = FieldValues>({
	field,
	control,
	error,
	options,
}: ControllerProps<T> & { options: SelectOption[] }) => (
	<Controller
		name={field.name as Path<T>}
		control={control}
		defaultValue={(field.defaultValue ?? "") as PathValue<T, Path<T>>}
		rules={selectRules<T>(field)}
		render={({ field: ctrl }) => (
			<ComboboxBox
				field={field}
				options={options}
				value={ctrl.value}
				onChange={ctrl.onChange}
				onBlur={ctrl.onBlur}
				inputRef={ctrl.ref}
				error={error}
			/>
		)}
	/>
);

const AsyncComboboxSelectInput = <T extends FieldValues = FieldValues>(
	props: ControllerProps<T>,
) => {
	const { loadOptions } = props.field;
	const optionsPromise = useMemo(() => loadOptions!(), [loadOptions]);
	return <ComboboxControl {...props} options={use(optionsPromise)} />;
};

export const ComboboxSelectInput = <T extends FieldValues = FieldValues>(
	props: ControllerProps<T>,
) => {
	if (props.field.loadOptions) {
		return (
			<Suspense fallback={<OptionsSkeleton />}>
				<AsyncComboboxSelectInput {...props} />
			</Suspense>
		);
	}
	return <ComboboxControl {...props} options={props.field.options ?? []} />;
};

// ─── Multi-select ─────────────────────────────────────────────────────────────
// Caps selections at field.maxSelections and shows a comma-joined summary of
// the chosen labels in the trigger.

const MultiSelectBox = ({
	field,
	options,
	selected,
	onChange,
	onBlur,
	error,
}: {
	field: FormFieldConfig;
	options: SelectOption[];
	selected: string[];
	onChange: (value: string[]) => void;
	onBlur: () => void;
	error?: string;
}) => {
	const listId = useId();
	const [open, setOpen] = useState(false);
	const atMax = !!field.maxSelections && selected.length >= field.maxSelections;
	const labels = options.filter((opt) => selected.includes(opt.value)).map((opt) => opt.label);

	const toggle = (opt: SelectOption) =>
		onChange(
			selected.includes(opt.value)
				? selected.filter((v) => v !== opt.value)
				: [...selected, opt.value],
		);

	return (
		<div
			className="relative"
			onBlur={(e) => {
				if (e.currentTarget.contains(e.relatedTarget)) return;
				setOpen(false);
				onBlur();
			}}
			onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
		>
			<button
				type="button"
				id={field.id ?? field.name}
				disabled={field.disabled}
				aria-haspopup="listbox"
				aria-expanded={open}
				aria-controls={listId}
				aria-describedby={describedBy(field, error)}
				onClick={() => setOpen((o) => !o)}
				className={cn(
					inputClass(error),
					"flex cursor-pointer items-center justify-between gap-2 text-left",
				)}
			>
				<span className={cn("truncate", labels.length === 0 && "text-fg-tertiary")}>
					{labels.length > 0
						? labels.join(", ")
						: (field.placeholder ?? "Select options")}
				</span>
				<ChevronDown aria-hidden="true" className="size-4 shrink-0 text-fg-tertiary" />
			</button>
			{open && (
				<div
					id={listId}
					role="group"
					aria-label={`${field.label ?? field.name} options`}
					className={panelClass}
				>
					{options.map((opt) => {
						const isSelected = selected.includes(opt.value);
						const disabled = atMax && !isSelected;
						return (
							<label
								key={opt.value}
								className={cn(
									optionClass,
									"hover:bg-subtle",
									disabled &&
										"cursor-not-allowed text-fg-tertiary hover:bg-transparent",
								)}
							>
								<input
									type="checkbox"
									checked={isSelected}
									disabled={disabled}
									onChange={() => toggle(opt)}
									className="size-4 cursor-[inherit] accent-accent"
								/>
								<span className="min-w-0 flex-1 truncate">{opt.label}</span>
							</label>
						);
					})}
				</div>
			)}
		</div>
	);
};

export const MultiSelectInput = <T extends FieldValues = FieldValues>({
	field,
	control,
	error,
}: ControllerProps<T>) => (
	<Controller
		name={field.name as Path<T>}
		control={control}
		defaultValue={[] as string[] as PathValue<T, Path<T>>}
		rules={selectRules<T>(field)}
		render={({ field: ctrl }) => (
			<MultiSelectBox
				field={field}
				options={field.options ?? []}
				selected={Array.isArray(ctrl.value) ? ctrl.value : []}
				onChange={ctrl.onChange}
				onBlur={ctrl.onBlur}
				error={error}
			/>
		)}
	/>
);

// ─── Radio / checkbox ─────────────────────────────────────────────────────────

// A small set of mutually exclusive options rendered inline.
export const RadioInput = <T extends FieldValues = FieldValues>({
	field,
	control,
	error,
}: ControllerProps<T>) => (
	<Controller
		name={field.name as Path<T>}
		control={control}
		defaultValue={(field.defaultValue ?? "") as PathValue<T, Path<T>>}
		rules={selectRules<T>(field)}
		render={({ field: ctrl }) => (
			<div
				role="radiogroup"
				id={field.id ?? field.name}
				aria-invalid={!!error || undefined}
				aria-describedby={describedBy(field, error)}
				className="flex flex-col gap-2"
			>
				{(field.options ?? []).map((opt) => (
					<label
						key={opt.value}
						className={cn(
							"flex items-center gap-2 text-body select-none",
							field.disabled
								? "cursor-not-allowed text-fg-tertiary"
								: "cursor-pointer",
						)}
					>
						<input
							type="radio"
							name={ctrl.name}
							value={opt.value}
							checked={ctrl.value === opt.value}
							disabled={field.disabled}
							onChange={() => ctrl.onChange(opt.value)}
							onBlur={ctrl.onBlur}
							className="size-4 cursor-[inherit] accent-accent"
						/>
						{opt.label}
					</label>
				))}
			</div>
		)}
	/>
);

export type CheckboxInputProps<T extends FieldValues = FieldValues> = ControllerProps<T> & {
	/** Override the checked state with a derived value instead of the raw field value. */
	checked?: boolean;
	/** Override the change handler — e.g. to guard against re-checking, or to sync a related field. */
	onCheckedChange?: (checked: boolean) => void;
};

export const CheckboxInput = <T extends FieldValues = FieldValues>({
	field,
	control,
	error,
	checked,
	onCheckedChange,
}: CheckboxInputProps<T>) => (
	<Controller
		name={field.name as Path<T>}
		control={control}
		defaultValue={(field.defaultValue ?? false) as PathValue<T, Path<T>>}
		rules={selectRules<T>(field)}
		render={({ field: ctrl }) => (
			<div className="flex items-center gap-2">
				<input
					type="checkbox"
					id={field.id ?? field.name}
					ref={ctrl.ref}
					disabled={field.disabled}
					checked={checked ?? !!ctrl.value}
					aria-invalid={!!error || undefined}
					aria-describedby={error ? `${field.id ?? field.name}-msg` : undefined}
					onChange={(e) =>
						onCheckedChange
							? onCheckedChange(e.target.checked)
							: ctrl.onChange(e.target.checked)
					}
					onBlur={ctrl.onBlur}
					className={cn(
						"size-4 shrink-0 cursor-pointer accent-accent disabled:cursor-not-allowed",
						error && "outline-1 outline-danger-fg",
					)}
				/>
				{field.label && (
					<label
						htmlFor={field.id ?? field.name}
						className={cn(
							"text-body select-none",
							field.disabled
								? "cursor-not-allowed text-fg-tertiary"
								: "cursor-pointer",
						)}
					>
						{field.label}
					</label>
				)}
			</div>
		)}
	/>
);

// ─── Date / date-time ─────────────────────────────────────────────────────────
// Native pickers: the value stays an ISO string, as before.

const DATE_FORMAT = "YYYY-MM-DD";
const DATETIME_FORMAT = "YYYY-MM-DDTHH:mm";

/** Adds field.isDateDisabled on top of the field's own rules, as a validation. */
const dateRules = <T extends FieldValues>(field: FormFieldConfig) => {
	const own = field.validation;
	if (!field.isDateDisabled) return own as RegisterOptions<T, Path<T>>;
	return {
		...own,
		validate: (value: string, formValues: T) => {
			if (value && field.isDateDisabled!(new Date(value))) return "That date isn't available";
			return typeof own?.validate === "function" ? own.validate(value, formValues) : true;
		},
	} as RegisterOptions<T, Path<T>>;
};

const NativeDate = <T extends FieldValues = FieldValues>({
	field,
	control,
	error,
	kind,
}: ControllerProps<T> & { kind: "date" | "datetime-local" }) => {
	const format = kind === "date" ? DATE_FORMAT : DATETIME_FORMAT;
	const bound = (d?: Date | string) => (d ? dayjs(d).format(format) : undefined);

	return (
		<Controller
			name={field.name as Path<T>}
			control={control}
			defaultValue={(field.defaultValue ?? "") as PathValue<T, Path<T>>}
			rules={dateRules<T>(field)}
			render={({ field: ctrl }) => (
				<input
					id={field.id ?? field.name}
					ref={ctrl.ref}
					type={kind}
					disabled={field.disabled}
					readOnly={field.readOnly}
					min={bound(field.minDate)}
					max={bound(field.maxDate)}
					aria-invalid={!!error || undefined}
					aria-describedby={describedBy(field, error)}
					value={ctrl.value ? dayjs(ctrl.value).format(format) : ""}
					onChange={(e) =>
						ctrl.onChange(e.target.value ? dayjs(e.target.value).toISOString() : "")
					}
					onBlur={ctrl.onBlur}
					className={cn(
						inputClass(error),
						"cursor-pointer",
						!ctrl.value && "text-fg-tertiary",
					)}
				/>
			)}
		/>
	);
};

export const DateInput = <T extends FieldValues = FieldValues>(props: ControllerProps<T>) => (
	<NativeDate {...props} kind="date" />
);

export const DateTimeInput = <T extends FieldValues = FieldValues>(props: ControllerProps<T>) => (
	<NativeDate {...props} kind="datetime-local" />
);

// File / Image upload
export { FileInput, type FileInputProps } from "./fileInput";

// ─── Money ────────────────────────────────────────────────────────────────────

// Number input with a leading currency symbol
export const DollarInput = <T extends FieldValues = FieldValues>({
	field,
	register,
	error,
}: InputProps<T>) => {
	const symbol = field.currencySymbol ?? DEFAULT_CURRENCY_SYMBOL;
	return (
		<div className="relative flex items-center">
			<span className="pointer-events-none absolute left-3 text-body text-fg-secondary select-none">
				{symbol}
			</span>
			<input
				id={field.id ?? field.name}
				type="number"
				placeholder={field.placeholder}
				disabled={field.disabled}
				min={field.min}
				max={field.max}
				step={field.step}
				aria-invalid={!!error || undefined}
				aria-describedby={describedBy(field, error)}
				className={cn(inputClass(error), "pl-8 tabular")}
				{...register(
					field.name as Path<T>,
					field.validation as RegisterOptions<T, Path<T>>,
				)}
			/>
		</div>
	);
};

// Amount — whole units only, shown with the currency symbol and thousands
// separators as you type ("₦3,000"). The form value is the plain digit
// string ("300000"), or "" when empty.
const MAX_AMOUNT_DIGITS = 12;

export const AmountInput = <T extends FieldValues = FieldValues>({
	field,
	control,
	error,
}: ControllerProps<T>) => {
	const symbol = field.currencySymbol ?? DEFAULT_CURRENCY_SYMBOL;

	return (
		<Controller
			name={field.name as Path<T>}
			control={control}
			defaultValue={(field.defaultValue ?? "") as PathValue<T, Path<T>>}
			rules={selectRules<T>(field)}
			render={({ field: ctrl }) => {
				const digits = String(ctrl.value ?? "");
				return (
					<input
						id={field.id ?? field.name}
						ref={ctrl.ref}
						name={ctrl.name}
						type="text"
						inputMode="numeric"
						autoComplete="off"
						placeholder={field.placeholder}
						disabled={field.disabled}
						aria-invalid={!!error || undefined}
						aria-describedby={describedBy(field, error)}
						value={digits ? `${symbol}${Number(digits).toLocaleString("en-NG")}` : ""}
						onChange={(e) =>
							ctrl.onChange(
								e.target.value
									.replace(/\D/g, "")
									.replace(/^0+(?=\d)/, "")
									.slice(0, MAX_AMOUNT_DIGITS),
							)
						}
						onBlur={ctrl.onBlur}
						className={cn(inputClass(error), "tabular")}
					/>
				);
			}}
		/>
	);
};

export const ErrorIcon = () => (
	<TriangleAlert aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={2} />
);

export const LoadingSpinner = () => <Loader2 aria-hidden="true" className="size-4 animate-spin" />;
