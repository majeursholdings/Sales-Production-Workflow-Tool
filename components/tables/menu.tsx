"use client";

import {
	createContext,
	useContext,
	useRef,
	useState,
	type ComponentProps,
	type KeyboardEvent,
	type ReactNode,
} from "react";
import { cn } from "@/lib/cn";

// ─────────────────────────────────────────────────────────────────────────────
// Menu — a button that opens a small action list (row "more" menu, Export).
// The list is `fixed` against the button, so a table's scroll box never clips
// it, and it opens upwards when there's no room below. Closes on Escape, on
// choosing an item, or when focus leaves.
// ─────────────────────────────────────────────────────────────────────────────

const CloseContext = createContext<() => void>(() => {});

type Position = { right: number; top?: number; bottom?: number };

const ITEMS = '[role="menuitem"]:not(:disabled)';
const MENU_HEIGHT_GUESS = 260;

export function Menu({
	trigger,
	triggerClassName,
	label,
	disabled,
	children,
}: {
	trigger: ReactNode;
	triggerClassName?: string;
	/** Names the button for screen readers and as a tooltip. */
	label: string;
	disabled?: boolean;
	children: ReactNode;
}) {
	const [pos, setPos] = useState<Position | null>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const open = pos !== null;
	const close = () => setPos(null);

	const toggle = () => {
		if (open) return close();
		const rect = triggerRef.current!.getBoundingClientRect();
		const right = window.innerWidth - rect.right;
		setPos(
			rect.bottom + MENU_HEIGHT_GUESS > window.innerHeight && rect.top > MENU_HEIGHT_GUESS
				? { right, bottom: window.innerHeight - rect.top + 4 }
				: { right, top: rect.bottom + 4 },
		);
	};

	const move = (e: KeyboardEvent<HTMLDivElement>, step: 1 | -1) => {
		e.preventDefault();
		const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>(ITEMS));
		if (!items.length) return;
		const at = items.indexOf(document.activeElement as HTMLElement);
		items[(at + step + items.length) % items.length].focus();
	};

	return (
		<div
			className="relative inline-flex"
			onBlur={(e) => {
				if (!e.currentTarget.contains(e.relatedTarget)) close();
			}}
			onKeyDown={(e) => {
				if (!open) return;
				if (e.key === "Escape") {
					close();
					triggerRef.current?.focus();
				} else if (e.key === "ArrowDown") move(e, 1);
				else if (e.key === "ArrowUp") move(e, -1);
			}}
		>
			<button
				ref={triggerRef}
				type="button"
				aria-haspopup="menu"
				aria-expanded={open}
				aria-label={label}
				title={label}
				disabled={disabled}
				onClick={toggle}
				className={triggerClassName}
			>
				{trigger}
			</button>
			{open && (
				<CloseContext.Provider value={close}>
					<div
						role="menu"
						style={pos}
						// keep focus on the item being pressed, so the blur above doesn't close the menu first
						onMouseDown={(e) => e.preventDefault()}
						// focus the first item as it opens
						ref={(el) => {
							if (el && !el.contains(document.activeElement))
								el.querySelector<HTMLElement>(ITEMS)?.focus();
						}}
						className="fixed z-40 flex min-w-44 flex-col rounded-lg border border-line bg-surface p-1 shadow-[0_8px_24px_rgb(33_29_26/0.12)]"
					>
						{children}
					</div>
				</CloseContext.Provider>
			)}
		</div>
	);
}

export function MenuItem({
	onSelect,
	tone,
	className,
	...props
}: { onSelect: () => void; tone?: "danger" } & Omit<ComponentProps<"button">, "onClick">) {
	const close = useContext(CloseContext);
	return (
		<button
			type="button"
			role="menuitem"
			onClick={() => {
				close();
				onSelect();
			}}
			className={cn(
				"flex min-h-9 w-full cursor-pointer items-center gap-2 rounded-sm px-3 text-start text-body whitespace-nowrap text-fg outline-none",
				"hover:bg-subtle focus-visible:bg-subtle [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-fg-tertiary",
				tone === "danger" &&
					"text-danger-fg hover:bg-danger-subtle focus-visible:bg-danger-subtle [&_svg]:text-danger-fg",
				"disabled:cursor-not-allowed disabled:text-fg-tertiary disabled:hover:bg-transparent",
				className,
			)}
			{...props}
		/>
	);
}
