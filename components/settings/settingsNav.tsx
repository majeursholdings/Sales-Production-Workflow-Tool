"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import type { SettingsGroup } from "./settingsSections";

/**
 * Section list. A vertical column from md up; on narrow screens it becomes a
 * single scrollable row so the content isn't pushed below a long list.
 */
export default function SettingsNav({ groups }: { groups: SettingsGroup[] }) {
	const pathname = usePathname();

	return (
		<nav
			aria-label="Settings sections"
			className="flex gap-1 overflow-x-auto max-md:pb-1 md:w-55 md:shrink-0 md:flex-col md:overflow-visible"
		>
			{groups.map((group) => (
				<div key={group.label} className="flex gap-1 md:flex-col">
					<span className="px-3 pt-3 pb-1 text-overline text-fg-tertiary uppercase max-md:sr-only">
						{group.label}
					</span>
					{group.sections.map((section) => {
						const active = pathname === section.href;
						return (
							<Link
								key={section.href}
								href={section.href}
								aria-current={active ? "page" : undefined}
								className={cn(
									"flex min-h-9 items-center rounded-md px-3 text-body whitespace-nowrap text-fg-secondary hover:bg-subtle hover:text-fg",
									"aria-[current=page]:bg-accent-subtle aria-[current=page]:font-bold aria-[current=page]:text-accent-fg",
								)}
							>
								{section.label}
							</Link>
						);
					})}
				</div>
			))}
		</nav>
	);
}
