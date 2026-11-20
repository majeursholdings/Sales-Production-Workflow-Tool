import type { ReactNode } from "react";
import { Badge, type BadgeVariant } from "@/components/common/badge";

// ─────────────────────────────────────────────────────────────────────────────
// StatusBadge — a status pill for a table cell. The tone follows the design's
// status colours; the text always says the status, colour is never the only signal.
// ─────────────────────────────────────────────────────────────────────────────

export type StatusTone = BadgeVariant;

export interface StatusBadgeProps {
	tone?: StatusTone;
	children: ReactNode;
}

export function StatusBadge({ tone = "neutral", children }: StatusBadgeProps) {
	return <Badge variant={tone}>{children}</Badge>;
}
