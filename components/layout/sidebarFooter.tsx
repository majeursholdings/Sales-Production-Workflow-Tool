"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, LogOut, Moon, Settings, Sun } from "lucide-react";
import { toast } from "sonner";
import { signOut } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { useTheme } from "@/providers/theme-provider";
import { Avatar } from "@/components/common/card";

type SidebarFooterProps = {
	userName: string;
	userRole: string;
	collapsed?: boolean;
	settingsHref?: string;
};

/** Visually hide text but keep it for screen readers (used when the sidebar is collapsed). */
const hidden = "sr-only";

const link =
	"relative flex min-h-9 w-full cursor-pointer items-center gap-3 rounded-md px-3 text-start text-body text-fg-secondary hover:bg-subtle hover:text-fg focus-visible:-outline-offset-2 aria-[current=page]:bg-accent-subtle aria-[current=page]:font-bold aria-[current=page]:text-accent-fg";

export default function SidebarFooter({
	userName,
	userRole,
	collapsed = false,
	settingsHref = "/settings",
}: SidebarFooterProps) {
	const pathname = usePathname();
	const router = useRouter();
	const { resolvedTheme, setTheme } = useTheme();
	const [signingOut, setSigningOut] = useState(false);

	const isDark = resolvedTheme === "dark";
	const ThemeIcon = isDark ? Moon : Sun;
	const initials = userName
		.split(" ")
		.map((word) => word[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();

	const handleSignOut = async () => {
		if (signingOut) return;
		setSigningOut(true);
		const result = await signOut();
		if (!result.ok) {
			toast.error(result.message);
			setSigningOut(false);
			return;
		}
		router.push("/login");
		router.refresh();
	};

	return (
		<div className="flex flex-col gap-3 border-t border-line pt-3">
			<div className="flex flex-col gap-0.5">
				<Link
					href={settingsHref}
					className={cn(link, collapsed && "justify-center px-0")}
					aria-current={pathname.startsWith(settingsHref) ? "page" : undefined}
					title="Settings"
				>
					<Settings className="size-5 shrink-0" aria-hidden="true" />
					<span className={cn("min-w-0 flex-1", collapsed && hidden)}>Settings</span>
				</Link>

				<button
					type="button"
					role="switch"
					aria-checked={isDark}
					title="Dark mode"
					onClick={() => setTheme(isDark ? "light" : "dark")}
					className={cn(link, "group", collapsed && "justify-center px-0")}
				>
					<ThemeIcon className="size-5 shrink-0" aria-hidden="true" />
					<span className={cn("min-w-0 flex-1", collapsed && hidden)}>Dark mode</span>
					{!collapsed && (
						<span
							aria-hidden="true"
							className="relative ms-auto h-4.5 w-8 shrink-0 rounded-full bg-line-control group-aria-checked:bg-accent"
						>
							<span className="absolute inset-s-0.5 top-0.5 size-3.5 rounded-full bg-surface transition-[inset-inline-start] duration-150 group-aria-checked:inset-s-4" />
						</span>
					)}
				</button>
			</div>

			<div className={cn("flex items-center gap-3", collapsed ? "flex-col gap-2" : "ps-3")}>
				<Avatar initials={initials} className="shrink-0" />
				<div className={cn("flex min-w-0 flex-1 flex-col", collapsed && hidden)}>
					<span className="text-body font-bold wrap-anywhere">{userName}</span>
					<span className="text-small text-fg-tertiary">{userRole}</span>
				</div>
				<button
					type="button"
					onClick={handleSignOut}
					disabled={signingOut}
					aria-label="Sign out"
					title="Sign out"
					className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-md text-fg-secondary hover:bg-subtle hover:text-fg focus-visible:-outline-offset-2 disabled:opacity-50"
				>
					{signingOut ? (
						<Loader2 className="size-5 animate-spin" aria-hidden="true" />
					) : (
						<LogOut className="size-5" aria-hidden="true" />
					)}
				</button>
			</div>
		</div>
	);
}
