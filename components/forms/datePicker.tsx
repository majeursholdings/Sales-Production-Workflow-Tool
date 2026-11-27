"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import dayjs, { type Dayjs } from "dayjs";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { controlClass } from "./input";

/**
 * A date field that always writes the month in words ("12 Apr 2026", or
 * "21 May" for a birthday) instead of the browser's 12/04/2026, with a
 * calendar to pick from. Used by every date field in the app.
 *
 * Values: "date" mode is "YYYY-MM-DD"; "day-month" mode (birthdays, no year)
 * is "MM-DD". Empty string when nothing is picked.
 */

export type DatePickerMode = "date" | "day-month";

export type DatePickerProps = {
	id?: string;
	value: string;
	onChange: (value: string) => void;
	onBlur?: () => void;
	mode?: DatePickerMode;
	/** Earliest and latest days that can be picked, "YYYY-MM-DD" (date mode). */
	min?: string;
	max?: string;
	/** Days to grey out on top of min and max. */
	isDateDisabled?: (date: Date) => boolean;
	disabled?: boolean;
	placeholder?: string;
	/** Offer "Clear" in the calendar, for optional dates. */
	clearable?: boolean;
	invalid?: boolean;
	"aria-describedby"?: string;
	"aria-label"?: string;
	/** A shorter field (h-9), e.g. in a filter bar. */
	compact?: boolean;
	/** Extra classes for the field. */
	className?: string;
};

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
/** A leap year, so 29 Feb can be a birthday. */
const ANY_YEAR = 2000;
/** Years shown at once when jumping between years. */
const YEARS_PER_PAGE = 12;

type View = "days" | "months" | "years";

/** "2026-04-12" → "12 Apr 2026"; "05-21" → "21 May". */
export function formatPickedDate(value: string, mode: DatePickerMode = "date") {
	if (!value) return "";
	if (mode === "day-month") {
		const d = dayjs(`${ANY_YEAR}-${value}`);
		return d.isValid() ? d.format("D MMMM") : value;
	}
	const d = dayjs(value);
	return d.isValid() ? d.format("D MMM YYYY") : value;
}

export function DatePicker({
	id,
	value,
	onChange,
	onBlur,
	mode = "date",
	min,
	max,
	isDateDisabled,
	disabled,
	placeholder,
	clearable,
	invalid,
	compact,
	className,
	...aria
}: DatePickerProps) {
	const panelId = useId();
	const dayMonth = mode === "day-month";
	const triggerRef = useRef<HTMLButtonElement>(null);
	/** Set when the highlighted item (day, month or year) should take focus on the next render. */
	const focusCurrent = useRef(false);

	const picked = value ? (dayMonth ? dayjs(`${ANY_YEAR}-${value}`) : dayjs(value)) : null;
	const today = dayjs().startOf("day");
	const minDay = min ? dayjs(min).startOf("day") : null;
	const maxDay = max ? dayjs(max).startOf("day") : null;

	const [open, setOpen] = useState(false);
	/** The day the keyboard is on; its month and year are the ones shown. */
	const [cursor, setCursor] = useState<Dayjs>(today);
	/** Days of a month, the twelve months, or a page of years to jump between. */
	const [view, setView] = useState<View>("days");

	const blocked = (d: Dayjs) =>
		!dayMonth &&
		((minDay && d.isBefore(minDay, "day")) ||
			(maxDay && d.isAfter(maxDay, "day")) ||
			(isDateDisabled?.(d.toDate()) ?? false));

	/** A whole month or year with nothing pickable in it (outside min/max). */
	const outOfRange = (start: Dayjs, unit: "month" | "year") =>
		!dayMonth &&
		((!!minDay && start.endOf(unit).isBefore(minDay, "day")) ||
			(!!maxDay && start.startOf(unit).isAfter(maxDay, "day")));

	/** Keeps a day inside min/max, so the calendar never opens on a month you can't pick from. */
	const clamp = (d: Dayjs) => {
		if (dayMonth) return d.year(ANY_YEAR);
		if (minDay && d.isBefore(minDay)) return minDay;
		if (maxDay && d.isAfter(maxDay)) return maxDay;
		return d;
	};

	const show = (next: View, at: Dayjs = cursor) => {
		focusCurrent.current = true;
		setCursor(at);
		setView(next);
	};

	const openPanel = () => {
		setCursor(clamp(picked?.isValid() ? picked : today));
		setView("days");
		focusCurrent.current = true;
		setOpen(true);
	};

	const close = (refocus = false) => {
		setOpen(false);
		if (refocus) triggerRef.current?.focus();
	};

	const pick = (d: Dayjs) => {
		if (blocked(d)) return;
		onChange(dayMonth ? d.format("MM-DD") : d.format("YYYY-MM-DD"));
		close(true);
	};

	/** The same day in another month, e.g. 31 Jan → 28 Feb rather than spilling into March. */
	const inMonth = (d: Dayjs, month: number, year = d.year()) => {
		const first = d.date(1).year(year).month(month);
		return first.date(Math.min(d.date(), first.daysInMonth()));
	};

	const move = (d: Dayjs) => {
		// Day-and-month stays in one (leap) year, wrapping round.
		show(view, dayMonth ? d.year(ANY_YEAR) : d);
	};

	const yearPageStart = Math.floor(cursor.year() / YEARS_PER_PAGE) * YEARS_PER_PAGE;

	/** Arrow keys move through whichever grid is showing. */
	const onGridKey = (e: KeyboardEvent) => {
		const unit = view === "days" ? "day" : view === "months" ? "month" : "year";
		const across = view === "days" ? 7 : 3;
		const steps: Record<string, () => Dayjs> =
			view === "days"
				? {
						ArrowLeft: () => cursor.subtract(1, "day"),
						ArrowRight: () => cursor.add(1, "day"),
						ArrowUp: () => cursor.subtract(7, "day"),
						ArrowDown: () => cursor.add(7, "day"),
						PageUp: () => cursor.subtract(1, e.shiftKey ? "year" : "month"),
						PageDown: () => cursor.add(1, e.shiftKey ? "year" : "month"),
						Home: () => cursor.startOf("month"),
						End: () => cursor.endOf("month").startOf("day"),
					}
				: {
						ArrowLeft: () => cursor.subtract(1, unit),
						ArrowRight: () => cursor.add(1, unit),
						ArrowUp: () => cursor.subtract(across, unit),
						ArrowDown: () => cursor.add(across, unit),
						PageUp: () =>
							cursor.subtract(view === "months" ? 1 : YEARS_PER_PAGE, "year"),
						PageDown: () => cursor.add(view === "months" ? 1 : YEARS_PER_PAGE, "year"),
					};
		const step = steps[e.key];
		if (!step) return;
		e.preventDefault();
		move(step());
	};

	/** Focuses the highlighted item once, after the keyboard or a view change moved to it. */
	const focusIfCurrent = (isCurrent: boolean) =>
		isCurrent
			? (el: HTMLButtonElement | null) => {
					if (el && focusCurrent.current) {
						focusCurrent.current = false;
						el.focus();
					}
				}
			: undefined;

	const monthStart = cursor.startOf("month");
	const lead = dayMonth ? 0 : (monthStart.day() + 6) % 7;
	const days = Array.from({ length: monthStart.daysInMonth() }, (_, i) =>
		monthStart.add(i, "day"),
	);
	const shown = value ? formatPickedDate(value, mode) : "";

	/** Previous / next: a month on the days view, a year on the months view, a page on the years view. */
	const stepBy = (dir: 1 | -1) => {
		if (view === "days") return move(cursor.add(dir, "month"));
		if (view === "months") return move(cursor.add(dir, "year"));
		return move(cursor.add(dir * YEARS_PER_PAGE, "year"));
	};
	const stepLabel = (dir: 1 | -1) =>
		`${dir < 0 ? "Previous" : "Next"} ${view === "days" ? "month" : view === "months" ? "year" : `${YEARS_PER_PAGE} years`}`;
	const stepDisabled = (dir: 1 | -1) => {
		if (dayMonth) return false;
		if (view === "days") return outOfRange(cursor.add(dir, "month").startOf("month"), "month");
		if (view === "months") return outOfRange(cursor.add(dir, "year").startOf("year"), "year");
		const edge = dayjs(`${yearPageStart + (dir < 0 ? -1 : YEARS_PER_PAGE)}-01-01`);
		return outOfRange(edge, "year");
	};

	const navButton = (dir: 1 | -1) =>
		// Birthdays have no year, so there's nothing to step through on the month grid.
		dayMonth && view === "months" ? (
			<span aria-hidden="true" className="size-8 shrink-0" />
		) : (
			<button
				type="button"
				aria-label={stepLabel(dir)}
				disabled={stepDisabled(dir)}
				onClick={() => stepBy(dir)}
				className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-sm text-fg-secondary hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
			>
				{dir < 0 ? (
					<ChevronLeft aria-hidden="true" className="size-4" />
				) : (
					<ChevronRight aria-hidden="true" className="size-4" />
				)}
			</button>
		);

	/** The clickable month or year in the header, which opens its picker. */
	const captionButton = (label: string, target: View, a11y: string) => (
		<button
			type="button"
			aria-label={a11y}
			aria-expanded={view === target}
			onClick={() => show(view === target ? "days" : target)}
			className={cn(
				"inline-flex h-8 cursor-pointer items-center gap-1 rounded-sm px-2 text-body font-bold text-fg hover:bg-subtle",
				view === target && "bg-subtle",
			)}
		>
			{label}
			<ChevronDown aria-hidden="true" className="size-3.5 text-fg-tertiary" />
		</button>
	);

	const cellClass = (current: boolean, isPicked: boolean, off: boolean) =>
		cn(
			"grid cursor-pointer place-items-center rounded-sm text-body tabular outline-none",
			"hover:bg-subtle focus-visible:ring-2 focus-visible:ring-focus",
			current && !isPicked && "font-bold text-accent-fg",
			isPicked && "bg-accent text-on-accent hover:bg-accent-hover",
			off && "cursor-not-allowed text-fg-tertiary opacity-50 hover:bg-transparent",
		);

	return (
		<div
			className="relative"
			onBlur={(e) => {
				if (e.currentTarget.contains(e.relatedTarget)) return;
				setOpen(false);
				onBlur?.();
			}}
			onKeyDown={(e) => {
				if (e.key !== "Escape" || !open) return;
				e.stopPropagation();
				// Escape backs out of the month or year picker first, then closes.
				if (view !== "days") show("days");
				else close(true);
			}}
		>
			<button
				ref={triggerRef}
				type="button"
				id={id}
				disabled={disabled}
				aria-haspopup="dialog"
				aria-expanded={open}
				aria-controls={open ? panelId : undefined}
				aria-describedby={aria["aria-describedby"]}
				aria-label={aria["aria-label"]}
				onClick={() => (open ? close() : openPanel())}
				className={cn(
					controlClass,
					"flex cursor-pointer items-center justify-between gap-2 text-left",
					compact ? "h-9" : "h-10",
					invalid && "border-danger-fg",
					className,
				)}
			>
				<span className={cn("truncate", !shown && "text-fg-tertiary")}>
					{shown || placeholder || (dayMonth ? "Day and month" : "Pick a date")}
				</span>
				<CalendarDays aria-hidden="true" className="size-4 shrink-0 text-fg-tertiary" />
			</button>

			{open && (
				<div
					id={panelId}
					role="dialog"
					aria-label={dayMonth ? "Pick a day and month" : "Pick a date"}
					className="absolute top-full left-0 z-30 mt-1 flex w-72 flex-col gap-2 rounded-md border border-line bg-surface p-3 shadow-[0_8px_24px_rgb(33_29_26/0.15)]"
				>
					<div className="flex items-center justify-between gap-1">
						{navButton(-1)}
						<div aria-live="polite" className="flex items-center gap-0.5">
							{view === "years" ? (
								<button
									type="button"
									aria-label="Back to the months"
									onClick={() => show("months")}
									className="inline-flex h-8 cursor-pointer items-center rounded-sm px-2 text-body font-bold text-fg hover:bg-subtle"
								>
									{yearPageStart} – {yearPageStart + YEARS_PER_PAGE - 1}
								</button>
							) : (
								<>
									{view === "days" &&
										captionButton(
											cursor.format("MMMM"),
											"months",
											`${cursor.format("MMMM")}, change the month`,
										)}
									{!dayMonth &&
										captionButton(
											cursor.format("YYYY"),
											"years",
											`${cursor.format("YYYY")}, change the year`,
										)}
									{dayMonth && view === "months" && (
										<strong className="px-2 text-body text-fg">
											Pick a month
										</strong>
									)}
								</>
							)}
						</div>
						{navButton(1)}
					</div>

					{view === "days" && (
						<div role="grid" onKeyDown={onGridKey} className="grid grid-cols-7 gap-0.5">
							{!dayMonth &&
								WEEKDAYS.map((w) => (
									<span
										key={w}
										role="columnheader"
										className="grid h-7 place-items-center text-small text-fg-tertiary"
									>
										{w}
									</span>
								))}
							{Array.from({ length: lead }, (_, i) => (
								<span key={`lead-${i}`} aria-hidden="true" />
							))}
							{days.map((d) => {
								const isCursor = d.isSame(cursor, "day");
								const off = blocked(d);
								return (
									<button
										key={d.format("YYYY-MM-DD")}
										type="button"
										role="gridcell"
										tabIndex={isCursor ? 0 : -1}
										ref={focusIfCurrent(isCursor)}
										aria-selected={!!picked && d.isSame(picked, "day")}
										aria-disabled={off || undefined}
										aria-label={d.format(
											dayMonth ? "D MMMM" : "dddd D MMMM YYYY",
										)}
										onClick={() => pick(d)}
										className={cn(
											cellClass(
												!dayMonth && d.isSame(today, "day"),
												!!picked && d.isSame(picked, "day"),
												!!off,
											),
											"h-9",
											off && "line-through",
										)}
									>
										{d.date()}
									</button>
								);
							})}
						</div>
					)}

					{view === "months" && (
						<div role="grid" onKeyDown={onGridKey} className="grid grid-cols-3 gap-1">
							{Array.from({ length: 12 }, (_, m) => {
								const at = inMonth(cursor, m);
								const isCursor = m === cursor.month();
								const off = outOfRange(at.startOf("month"), "month");
								return (
									<button
										key={m}
										type="button"
										role="gridcell"
										tabIndex={isCursor ? 0 : -1}
										ref={focusIfCurrent(isCursor)}
										aria-selected={
											!!picked &&
											picked.month() === m &&
											(dayMonth || picked.year() === cursor.year())
										}
										aria-disabled={off || undefined}
										aria-label={at.format(dayMonth ? "MMMM" : "MMMM YYYY")}
										onClick={() => !off && show("days", clamp(at))}
										className={cn(
											cellClass(
												!dayMonth &&
													today.year() === cursor.year() &&
													today.month() === m,
												!!picked &&
													picked.month() === m &&
													(dayMonth || picked.year() === cursor.year()),
												off,
											),
											"h-11",
										)}
									>
										{at.format("MMM")}
									</button>
								);
							})}
						</div>
					)}

					{view === "years" && (
						<div role="grid" onKeyDown={onGridKey} className="grid grid-cols-3 gap-1">
							{Array.from({ length: YEARS_PER_PAGE }, (_, i) => {
								const year = yearPageStart + i;
								const at = inMonth(cursor, cursor.month(), year);
								const isCursor = year === cursor.year();
								const off = outOfRange(at.startOf("year"), "year");
								return (
									<button
										key={year}
										type="button"
										role="gridcell"
										tabIndex={isCursor ? 0 : -1}
										ref={focusIfCurrent(isCursor)}
										aria-selected={!!picked && picked.year() === year}
										aria-disabled={off || undefined}
										onClick={() => !off && show("months", at)}
										className={cn(
											cellClass(
												today.year() === year,
												!!picked && picked.year() === year,
												off,
											),
											"h-11",
										)}
									>
										{year}
									</button>
								);
							})}
						</div>
					)}

					{(clearable || !dayMonth) && (
						<div className="flex items-center justify-between gap-2 border-t border-line pt-2">
							{!dayMonth && !blocked(today) ? (
								<button
									type="button"
									onClick={() => pick(today)}
									className="cursor-pointer text-small font-bold text-accent-fg hover:underline"
								>
									Today
								</button>
							) : (
								<span />
							)}
							{clearable && value && (
								<button
									type="button"
									onClick={() => {
										onChange("");
										close(true);
									}}
									className="cursor-pointer text-small text-fg-secondary hover:underline"
								>
									Clear
								</button>
							)}
						</div>
					)}
				</div>
			)}
		</div>
	);
}

/** A labelled DatePicker for outside react-hook-form, laid out like Input. */
export function DateField({
	label,
	hint,
	className,
	id,
	...props
}: Omit<DatePickerProps, "aria-describedby"> & {
	label: string;
	hint?: string;
	className?: string;
}) {
	const auto = useId();
	const fid = id ?? auto;
	return (
		<div className={cn("flex min-w-0 flex-col gap-2", className)}>
			<label htmlFor={fid} className="text-body font-bold">
				{label}
			</label>
			<DatePicker id={fid} aria-describedby={hint ? `${fid}-msg` : undefined} {...props} />
			{hint && (
				<small id={`${fid}-msg`} className="text-small text-fg-tertiary">
					{hint}
				</small>
			)}
		</div>
	);
}
