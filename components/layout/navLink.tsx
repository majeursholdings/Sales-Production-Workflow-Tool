import Link from "next/link";
import { cn } from "@/lib/cn";
import type { NavItem } from "./navigation";

type NavLinkProps = {
	item: NavItem;
	active: boolean;
	/** Number waiting on this item; hidden at 0. */
	count?: number;
	collapsed?: boolean;
	/** "lg" = 48px touch target (mobile sheet). */
	size?: "md" | "lg";
	onNavigate?: () => void;
};

export default function NavLink({
	item,
	active,
	count = 0,
	collapsed = false,
	size = "md",
	onNavigate,
}: NavLinkProps) {
	const Icon = item.icon;
	return (
		<Link
			href={item.href}
			title={item.label}
			aria-current={active ? "page" : undefined}
			onClick={onNavigate}
			className={cn(
				"relative flex items-center gap-3 rounded-md px-3 text-body text-fg-secondary hover:bg-subtle hover:text-fg focus-visible:-outline-offset-2",
				"aria-[current=page]:bg-accent-subtle aria-[current=page]:font-bold aria-[current=page]:text-accent-fg",
				size === "lg" ? "min-h-12" : "min-h-9",
				collapsed && "justify-center px-0",
			)}
		>
			<Icon className="size-5 shrink-0" aria-hidden="true" />
			<span className={cn("min-w-0 flex-1", collapsed && "sr-only")}>{item.label}</span>
			{count > 0 && (
				<span
					aria-label={`${count} waiting`}
					className={cn(
						"grid place-items-center rounded-full bg-accent font-bold text-on-accent",
						collapsed
							? "absolute end-0.5 top-0.5 h-4 min-w-4 px-1 text-overline tracking-normal"
							: "h-5 min-w-5 px-1.5 text-xs",
					)}
				>
					{count}
				</span>
			)}
		</Link>
	);
}
