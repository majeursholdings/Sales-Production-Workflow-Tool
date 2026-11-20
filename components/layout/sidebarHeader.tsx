import Link from "next/link";
import { Bell, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/cn";
import Icon from "./icon";
import Logo from "./logo";

type SidebarHeaderProps = {
	mode: "light" | "dark";
	/** Unread notifications; the count badge is hidden at 0. */
	unreadNotificationsCount?: number;
	collapsed?: boolean;
	onToggleCollapsed: () => void;
	notificationsHref?: string;
};

const iconButton =
	"relative grid size-9 shrink-0 cursor-pointer place-items-center rounded-md text-fg-secondary hover:bg-subtle hover:text-fg focus-visible:-outline-offset-2";

export default function SidebarHeader({
	mode,
	unreadNotificationsCount = 0,
	collapsed = false,
	onToggleCollapsed,
	notificationsHref = "/notifications",
}: SidebarHeaderProps) {
	const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;
	const toggleLabel = collapsed ? "Expand sidebar" : "Collapse sidebar";

	return (
		<div className={cn("flex items-start gap-2", collapsed ? "flex-col items-center" : "ps-3")}>
			{collapsed ? (
				<div className="grid size-9 place-items-center">
					<Icon mode={mode} />
				</div>
			) : (
				<div className="flex min-w-0 flex-1 flex-col gap-1">
					<Logo mode={mode} />
					<span className="text-small text-fg-tertiary">Quote tool</span>
				</div>
			)}
			<NotificationBadge
				href={notificationsHref}
				unreadNotificationsCount={unreadNotificationsCount}
			/>
			<button
				type="button"
				className={iconButton}
				aria-expanded={!collapsed}
				aria-label={toggleLabel}
				title={toggleLabel}
				onClick={onToggleCollapsed}
			>
				<ToggleIcon className="size-5" aria-hidden="true" />
			</button>
		</div>
	);
}

function NotificationBadge({
	href,
	unreadNotificationsCount,
}: {
	href: string;
	unreadNotificationsCount: number;
}) {
	const label =
		unreadNotificationsCount > 0
			? `Notifications, ${unreadNotificationsCount} unread`
			: "Notifications";

	return (
		<Link href={href} className={iconButton} aria-label={label} title="Notifications">
			<Bell className="size-5" aria-hidden="true" />
			{unreadNotificationsCount > 0 && (
				<span
					aria-hidden="true"
					className="absolute inset-e-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-overline font-bold tracking-normal text-on-accent"
				>
					{unreadNotificationsCount > 99 ? "99+" : unreadNotificationsCount}
				</span>
			)}
		</Link>
	);
}
