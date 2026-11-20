import Link from "next/link";
import { Avatar } from "@/components/common/card";

// ─────────────────────────────────────────────────────────────────────────────
// AvatarCell — the first column of a people table: initials, a bold name
// (a link when `href` is set) and up to two grey lines under it.
// ─────────────────────────────────────────────────────────────────────────────

export interface AvatarCellProps {
	name: string;
	/** Contact line, role, company… */
	subtitle?: string;
	/** A second grey line, e.g. a location. */
	detail?: string;
	href?: string;
}

const initialsOf = (name: string) =>
	name
		.split(/\s+/)
		.filter(Boolean)
		.map((word) => word[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();

export function AvatarCell({ name, subtitle, detail, href }: AvatarCellProps) {
	return (
		<span className="flex items-center gap-3">
			<Avatar initials={initialsOf(name)} />
			<span className="flex min-w-0 flex-col">
				{href ? (
					<Link href={href} className="font-bold text-fg no-underline hover:underline">
						{name}
					</Link>
				) : (
					<span className="font-bold text-fg">{name}</span>
				)}
				{subtitle && <span className="text-small text-fg-tertiary">{subtitle}</span>}
				{detail && <span className="text-small text-fg-tertiary">{detail}</span>}
			</span>
		</span>
	);
}
