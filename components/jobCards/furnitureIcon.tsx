import {
	Armchair,
	Archive,
	BedDouble,
	Briefcase,
	Coffee,
	Package,
	Sofa,
	UtensilsCrossed,
	type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { FurnitureKind } from "@/lib/jobCards";

const ICONS: Record<FurnitureKind, LucideIcon> = {
	sofa: Sofa,
	coffee: Coffee,
	lounge: Armchair,
	dining: UtensilsCrossed,
	dchair: Armchair,
	desk: Briefcase,
	bed: BedDouble,
	storage: Archive,
	other: Package,
};

/** Stand-in for a furniture photo until photo upload is connected. */
export default function FurnitureIcon({
	kind,
	className,
}: {
	kind: FurnitureKind;
	className?: string;
}) {
	const Icon = ICONS[kind];
	return (
		<span
			aria-hidden="true"
			className={cn(
				"grid size-11 shrink-0 place-items-center rounded-md border border-line bg-accent-subtle text-accent-fg [&_svg]:size-6",
				className,
			)}
		>
			<Icon />
		</span>
	);
}
