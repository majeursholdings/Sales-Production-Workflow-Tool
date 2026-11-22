"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Bell, Menu, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { useTheme } from "@/providers/theme-provider";
import Logo from "./logo";
import NavLink from "./navLink";
import { NAV_ITEMS, getNavForRole, isActive } from "./navigation";
import SidebarFooter from "./sidebarFooter";
import type { SidebarProps } from "./sidebar";

const tabBase =
	"relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-small text-fg-secondary focus-visible:-outline-offset-2 aria-[current=page]:font-bold aria-[current=page]:text-accent-fg";

/** Phone / narrow layout (<= 860px): top bar, bottom tabs and a "More" sheet. */
export default function MobileNav({
	userName,
	userRole,
	unreadNotificationsCount = 0,
	counts = {},
}: SidebarProps) {
	const pathname = usePathname();
	const { resolvedTheme } = useTheme();
	const [moreOpen, setMoreOpen] = useState(false);
	const { groups, tabs } = getNavForRole(userRole);

	const sheetGroups = groups
		.map((g) => ({ ...g, keys: g.keys.filter((k) => !tabs.includes(k)) }))
		.filter((g) => g.keys.length > 0);
	const moreCurrent = !tabs.some((k) => isActive(pathname, NAV_ITEMS[k].href));

	return (
		<div className="min-[861px]:hidden print:hidden">
			<header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-line bg-surface px-4">
				<Logo mode={resolvedTheme} />
				<span className="flex-1" />
				<Link
					href="/notifications"
					aria-label={
						unreadNotificationsCount > 0
							? `Notifications, ${unreadNotificationsCount} unread`
							: "Notifications"
					}
					className="relative grid size-11 place-items-center rounded-md text-fg-secondary hover:bg-subtle hover:text-fg"
				>
					<Bell className="size-5" aria-hidden="true" />
					{unreadNotificationsCount > 0 && (
						<span
							aria-hidden="true"
							className="absolute end-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-overline font-bold tracking-normal text-on-accent"
						>
							{unreadNotificationsCount}
						</span>
					)}
				</Link>
			</header>

			<nav
				aria-label="Main"
				className="fixed inset-x-0 bottom-0 z-20 flex border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]"
			>
				{tabs.map((key) => {
					const item = NAV_ITEMS[key];
					const Icon = item.icon;
					const count = counts[key] ?? 0;
					return (
						<Link
							key={key}
							href={item.href}
							aria-current={isActive(pathname, item.href) ? "page" : undefined}
							className={tabBase}
						>
							<Icon className="size-5" aria-hidden="true" />
							<span>{item.shortLabel}</span>
							{count > 0 && (
								<span
									aria-label={`${count} waiting`}
									className="absolute end-[calc(50%-22px)] top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-overline font-bold tracking-normal text-on-accent"
								>
									{count}
								</span>
							)}
						</Link>
					);
				})}
				<button
					type="button"
					className={cn(tabBase, "cursor-pointer")}
					aria-current={moreCurrent ? "page" : undefined}
					aria-expanded={moreOpen}
					aria-haspopup="dialog"
					onClick={() => setMoreOpen(true)}
				>
					<Menu className="size-5" aria-hidden="true" />
					<span>More</span>
				</button>
			</nav>

			{moreOpen && (
				<>
					<div
						className="fixed inset-0 z-30 bg-[rgb(33_29_26/0.4)]"
						onClick={() => setMoreOpen(false)}
					/>
					<section
						role="dialog"
						aria-modal="true"
						aria-labelledby="more-title"
						onKeyDown={(e) => e.key === "Escape" && setMoreOpen(false)}
						className="fixed inset-x-0 bottom-0 z-40 flex max-h-[85vh] flex-col rounded-t-lg border-t border-line bg-surface shadow-[0_-8px_24px_rgb(33_29_26/0.12)]"
					>
						<div className="flex items-center justify-between px-4 py-3">
							<h2 id="more-title" className="text-lg">
								Menu
							</h2>
							<button
								type="button"
								autoFocus
								aria-label="Close menu"
								title="Close"
								onClick={() => setMoreOpen(false)}
								className="grid size-11 cursor-pointer place-items-center rounded-md text-fg-secondary hover:bg-subtle hover:text-fg"
							>
								<X className="size-5" aria-hidden="true" />
							</button>
						</div>
						<div className="flex flex-col gap-4 overflow-auto px-4 pb-6">
							{sheetGroups.map((group) => (
								<div
									key={group.label || "overview"}
									role="group"
									aria-label={group.label || "Overview"}
									className="flex flex-col gap-0.5"
								>
									{group.label && (
										<span
											aria-hidden="true"
											className="px-3 pb-1 text-overline font-bold tracking-[0.06em] text-fg-tertiary uppercase"
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
											size="lg"
											onNavigate={() => setMoreOpen(false)}
										/>
									))}
								</div>
							))}
							<SidebarFooter userName={userName} userRole={userRole} />
						</div>
					</section>
				</>
			)}
		</div>
	);
}
