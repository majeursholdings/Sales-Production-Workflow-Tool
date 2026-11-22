import { Archive, Armchair, BedDouble, Monitor, Sofa, Table, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import type { FurnitureCategory } from "@/lib/furnitureTypes";

const ICONS: Record<FurnitureCategory, LucideIcon> = {
	Sofas: Sofa,
	Tables: Table,
	Beds: BedDouble,
	Chairs: Armchair,
	Storage: Archive,
	Office: Monitor,
};

/** Stand-in for a type's cover photo until photo upload is connected. */
export default function TypePhoto({
	category,
	size = "sm",
	label,
}: {
	category: FurnitureCategory;
	size?: "sm" | "lg";
	/** Alt text for a photo that stands alone. Leave off beside the type's name. */
	label?: string;
}) {
	const Icon = ICONS[category];
	return (
		<span
			role={label ? "img" : undefined}
			aria-label={label}
			aria-hidden={label ? undefined : true}
			className={cn(
				"grid shrink-0 place-items-center bg-subtle text-fg-tertiary",
				size === "lg"
					? "size-32 rounded-lg [&_svg]:size-14"
					: "size-10 rounded-md [&_svg]:size-5",
			)}
		>
			<Icon />
		</span>
	);
}
