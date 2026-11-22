"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { useSidebarCollapsed } from "@/lib/use-sidebar-collapsed";
import { useTheme } from "@/providers/theme-provider";
import NavLink from "./navLink";
import { NAV_ITEMS, getNavForRole, isActive, type NavKey } from "./navigation";
import SidebarFooter from "./sidebarFooter";
import SidebarHeader from "./sidebarHeader";

export type SidebarProps = {
	userName: string;
	userRole: string;
	unreadNotificationsCount?: number;
	/** Items waiting on the user, keyed by nav item (e.g. { requests: 2 }). */
	counts?: Partial<Record<NavKey, number>>;
};

/** Desktop sidebar (hidden under 860px; MobileNav takes over). 248px open, 72px collapsed. */
export default function Sidebar({
	userName,
	userRole,
	unreadNotificationsCount = 0,
	counts = {},
}: SidebarProps) {
	const pathname = usePathname();
	const { resolvedTheme } = useTheme();
	const [collapsed, setCollapsed] = useSidebarCollapsed();
	const { groups } = getNavForRole(userRole);

	return (
		<nav
			aria-label="Main"
			className={cn(
				"sticky top-0 box-border flex h-screen flex-none flex-col gap-6 overflow-hidden border-e border-line bg-surface pt-6 pb-4 transition-[width] duration-200 ease-[cubic-bezier(.2,0,0,1)] max-[860px]:hidden print:hidden",
				collapsed ? "w-16 px-3" : "w-62 px-4",
			)}
		>
			{/* Header stays pinned to the top; only the nav scrolls. */}
			<div className="shrink-0">
				<SidebarHeader
					mode={resolvedTheme}
					unreadNotificationsCount={unreadNotificationsCount}
					collapsed={collapsed}
					onToggleCollapsed={() => setCollapsed(!collapsed)}
				/>
			</div>

			<div
				className={cn(
					"flex min-h-0 flex-1 flex-col overflow-y-auto",
					"slim-scroll",
					collapsed ? "gap-3" : "gap-5",
				)}
			>
				{groups.map((group) => (
					<div
						key={group.label || "overview"}
						role="group"
						aria-label={group.label || "Overview"}
						className={cn(
							"flex flex-col gap-0.5",
							collapsed && "not-first:border-t not-first:border-line not-first:pt-3",
						)}
					>
						{group.label && (
							<span
								aria-hidden="true"
								className={cn(
									"px-3 pb-1.5 text-overline font-bold tracking-[0.06em] text-fg-tertiary uppercase",
									collapsed && "sr-only",
								)}
							>
								{group.label}
							</span>
						)}
						{group.keys.map((key) => (
							<NavLink
								key={key}
								item={NAV_ITEMS[key]}
								active={isActive(pathname, NAV_ITEMS[key].href)}
								count={counts[key]}
								collapsed={collapsed}
							/>
						))}
					</div>
				))}
			</div>

			{/* Footer stays pinned to the bottom. */}
			<div className="shrink-0">
				<SidebarFooter userName={userName} userRole={userRole} collapsed={collapsed} />
			</div>
		</nav>
	);
}
