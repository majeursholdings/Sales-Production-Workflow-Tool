import { Cog, Hammer, Ruler, Scissors, SprayCan, Wind, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import type { MachineIcon } from "@/lib/machines";

const ICONS: Record<MachineIcon, LucideIcon> = {
	saw: Hammer,
	planer: Hammer,
	cnc: Cog,
	sewing: Scissors,
	compressor: Wind,
	spray: SprayCan,
	edge: Ruler,
};

/** A machine's photo, or a stand-in icon when it has none. */
export default function MachinePhoto({
	icon,
	src,
	size = "sm",
	label,
}: {
	icon: MachineIcon;
	src?: string;
	size?: "sm" | "lg";
	/** Alt text for a photo that stands alone. Leave off beside the machine's name. */
	label?: string;
}) {
	if (src) {
		return (
			// eslint-disable-next-line @next/next/no-img-element -- served from authenticated /api/storage route
			<img
				src={src}
				alt={label ?? ""}
				aria-hidden={label ? undefined : true}
				className={cn(
					"shrink-0 border border-line object-cover",
					size === "lg" ? "aspect-4/3 w-full rounded-lg" : "size-11 rounded-md",
				)}
			/>
		);
	}
	const Icon = ICONS[icon];
	return (
		<span
			role={label ? "img" : undefined}
			aria-label={label}
			aria-hidden={label ? undefined : true}
			className={cn(
				"grid shrink-0 place-items-center border border-line bg-accent-subtle text-accent-fg",
				size === "lg"
					? "aspect-4/3 w-full rounded-lg [&_svg]:size-24 [&_svg]:stroke-[1.2]"
					: "size-11 rounded-md [&_svg]:size-6",
			)}
		>
			<Icon />
		</span>
	);
}
