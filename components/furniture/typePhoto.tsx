import {
	Archive,
	Armchair,
	BedDouble,
	Lamp,
	Monitor,
	Package,
	Sofa,
	Table,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Icons for common category names; anything else gets a generic one. */
const ICONS: [RegExp, ReactNode][] = [
	[/sofa|couch|seater/i, <Sofa key="sofa" />],
	[/table|desk/i, <Table key="table" />],
	[/bed/i, <BedDouble key="bed" />],
	[/chair|stool|seat/i, <Armchair key="chair" />],
	[/storage|wardrobe|cabinet|shel/i, <Archive key="storage" />],
	[/office/i, <Monitor key="office" />],
	[/light|lamp/i, <Lamp key="lamp" />],
];
const FALLBACK = <Package />;

const iconFor = (category: string) =>
	ICONS.find(([re]) => re.test(category))?.[1] ?? FALLBACK;

/** A type's cover photo, or an icon for its category when it has none. */
export default function TypePhoto({
	category,
	src,
	size = "sm",
	label,
}: {
	/** Category name, picks the stand-in icon. */
	category: string;
	/** Photo URL. */
	src?: string;
	size?: "sm" | "lg";
	/** Alt text for a photo that stands alone. Leave off beside the type's name. */
	label?: string;
}) {
	const box = size === "lg" ? "size-32 rounded-lg" : "size-10 rounded-md";
	if (src) {
		return (
			// eslint-disable-next-line @next/next/no-img-element -- photos come from storage URLs of any host
			<img
				src={src}
				alt={label ?? ""}
				aria-hidden={label ? undefined : true}
				className={cn("shrink-0 object-cover", box)}
			/>
		);
	}
	return (
		<span
			role={label ? "img" : undefined}
			aria-label={label}
			aria-hidden={label ? undefined : true}
			className={cn(
				"grid shrink-0 place-items-center bg-subtle text-fg-tertiary",
				box,
				size === "lg" ? "[&_svg]:size-14" : "[&_svg]:size-5",
			)}
		>
			{iconFor(category)}
		</span>
	);
}
