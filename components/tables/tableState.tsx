"use client";

import { useSyncExternalStore, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
	DatabaseZap,
	Inbox,
	RefreshCw,
	SearchX,
	TriangleAlert,
	WifiOff,
	type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/common/buttons";
import { cn } from "@/lib/cn";

// ─────────────────────────────────────────────────────────────────────────────
// TableState: what a table shows instead of rows. One component for every
// table, so empty data, a failed load and a dropped connection look and read
// the same everywhere.
//
//   <TableState kind="empty" title="No clients yet" action={<Button>Add client</Button>} />
//   <TableErrorState error={err} />            // picks offline / network / database / error
//
// DataTable renders these itself for its `emptyState` and `error` props, but
// they also work alone, e.g. inside a Card or an error boundary.
// ─────────────────────────────────────────────────────────────────────────────

export type TableStateKind =
	| "empty" // no records exist yet
	| "filtered" // records exist, none match the search / filters
	| "offline" // the browser has no connection
	| "network" // the connection dropped or timed out
	| "database" // the server is up but the data couldn't be read
	| "error"; // anything else that went wrong

const PRESETS: Record<
	TableStateKind,
	{ icon: LucideIcon; title: string; description: string; tone: "neutral" | "warning" | "danger" }
> = {
	empty: {
		icon: Inbox,
		title: "Nothing here yet",
		description: "Records you add will show up here.",
		tone: "neutral",
	},
	filtered: {
		icon: SearchX,
		title: "No results",
		description: "Try a different search, or clear the filters.",
		tone: "neutral",
	},
	offline: {
		icon: WifiOff,
		title: "You're offline",
		description:
			"Check your internet connection, then try again. Nothing you've saved is lost.",
		tone: "warning",
	},
	network: {
		icon: WifiOff,
		title: "Couldn't reach the server",
		description:
			"The connection dropped or is too slow. Check your internet connection and try again.",
		tone: "warning",
	},
	database: {
		icon: DatabaseZap,
		title: "Couldn't load this data",
		description:
			"We couldn't read it from the database. Your data is safe. Try again in a moment, and tell your admin if it keeps happening.",
		tone: "danger",
	},
	error: {
		icon: TriangleAlert,
		title: "Something went wrong",
		description: "We couldn't load this. Try again, and tell your admin if it keeps happening.",
		tone: "danger",
	},
};

const TONES = {
	neutral: "bg-subtle text-fg-secondary",
	warning: "bg-warning-subtle text-warning-fg",
	danger: "bg-danger-subtle text-danger-fg",
} as const;

const isProblem = (kind: TableStateKind) => kind !== "empty" && kind !== "filtered";

export function TableState({
	kind,
	title,
	description,
	action,
	compact,
	className,
}: {
	kind: TableStateKind;
	/** Overrides the preset heading. */
	title?: ReactNode;
	/** Overrides the preset explanation. */
	description?: ReactNode;
	/** Buttons under the text, e.g. "Try again" or "Add client". */
	action?: ReactNode;
	/** Less padding, for a table inside a small card. */
	compact?: boolean;
	className?: string;
}) {
	const preset = PRESETS[kind];
	const Icon = preset.icon;

	return (
		<div
			// a failure is announced when it appears; an empty table isn't news
			role={isProblem(kind) ? "alert" : "status"}
			className={cn(
				"mx-auto flex max-w-md flex-col items-center gap-3 text-center",
				compact ? "py-4" : "py-6",
				className,
			)}
		>
			<span
				aria-hidden="true"
				className={cn("grid size-12 place-items-center rounded-full", TONES[preset.tone])}
			>
				<Icon className="size-6" />
			</span>
			<div className="flex flex-col gap-1">
				<h3 className="text-h3 font-bold text-fg">{title ?? preset.title}</h3>
				<p className="text-body text-fg-secondary">{description ?? preset.description}</p>
			</div>
			{action && <div className="flex flex-wrap justify-center gap-3">{action}</div>}
		</div>
	);
}

// ── Connection and error classification ──────────────────────────────────

const subscribeToConnection = (notify: () => void) => {
	window.addEventListener("online", notify);
	window.addEventListener("offline", notify);
	return () => {
		window.removeEventListener("online", notify);
		window.removeEventListener("offline", notify);
	};
};

/** Whether the browser thinks it has a connection. Assumes online on the server. */
export function useIsOnline() {
	return useSyncExternalStore(
		subscribeToConnection,
		() => navigator.onLine,
		() => true,
	);
}

const NETWORK_ERROR =
	/failed to fetch|fetch failed|network ?error|load failed|timed? ?out|timeout|econn|enotfound|eai_again|socket hang up|offline/i;
const DATABASE_ERROR =
	/postgres|supabase|pgrst|database|relation .* does not exist|schema cache|row-level security|permission denied|failed to load/i;

/** Sorts a thrown value into the kind of state that explains it best. */
export function classifyTableError(error: unknown): Exclude<TableStateKind, "empty" | "filtered"> {
	const message =
		error instanceof Error
			? error.message
			: typeof error === "string"
				? error
				: typeof error === "object" && error !== null && "message" in error
					? String((error as { message: unknown }).message)
					: "";

	if (NETWORK_ERROR.test(message)) return "network";
	if (DATABASE_ERROR.test(message)) return "database";
	return "error";
}

/**
 * The failed-load state. Say what went wrong by passing the caught `error`;
 * with no connection it always reads "You're offline". "Try again" runs
 * `onRetry`, or refetches the page's server data when none is given.
 */
export function TableErrorState({
	error,
	onRetry,
	compact,
	className,
}: {
	error?: unknown;
	onRetry?: () => void | Promise<void>;
	compact?: boolean;
	className?: string;
}) {
	const router = useRouter();
	const online = useIsOnline();
	const [retrying, startRetry] = useTransition();
	const kind = online ? classifyTableError(error) : "offline";

	return (
		<TableState
			kind={kind}
			compact={compact}
			className={className}
			action={
				<Button
					disabled={retrying}
					onClick={() =>
						startRetry(async () => {
							if (onRetry) await onRetry();
							else router.refresh();
						})
					}
				>
					<RefreshCw className={retrying ? "animate-spin" : undefined} />
					{retrying ? "Trying again…" : "Try again"}
				</Button>
			}
		/>
	);
}
