import {
	Armchair,
	Package,
	PaintBucket,
	Sofa,
	TreePine,
	Wrench,
	type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";

/** Icon by the SKU's category prefix (TMB-, UPH-, …). */
const ICONS: Record<string, LucideIcon> = {
	TMB: TreePine,
	UPH: Sofa,
	SEA: Armchair,
	HDW: Wrench,
	FIN: PaintBucket,
};

/** Stand-in for a material's photo until photo upload is connected. */
export default function MaterialThumb({
	sku,
	size = "sm",
	label,
}: {
	sku: string;
	size?: "sm" | "lg";
	/** Alt text when it stands alone. Leave off beside the material's name. */
	label?: string;
}) {
	const Icon = ICONS[sku.split("-")[0]] ?? Package;
	return (
		<span
			role={label ? "img" : undefined}
			aria-label={label}
			aria-hidden={label ? undefined : true}
			className={cn(
				"grid shrink-0 place-items-center rounded-md border border-line bg-accent-subtle text-accent-fg",
				size === "lg" ? "size-16 [&_svg]:size-8" : "size-10 [&_svg]:size-5",
			)}
		>
			<Icon />
		</span>
	);
}
