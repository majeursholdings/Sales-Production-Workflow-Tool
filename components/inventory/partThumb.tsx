import Image from "next/image";
import MaterialThumb from "@/components/suppliers/materialThumb";
import { cn } from "@/lib/cn";
import type { Part } from "@/lib/inventory";

/** The part's photo, or its category icon until it has one. */
export default function PartThumb({
	part,
	size = "sm",
	label,
}: {
	part: Pick<Part, "sku" | "photoUrl">;
	size?: "sm" | "lg";
	/** Alt text when it stands alone. Leave off beside the part's name. */
	label?: string;
}) {
	if (!part.photoUrl) return <MaterialThumb sku={part.sku} size={size} label={label} />;
	return (
		<Image
			src={part.photoUrl}
			alt={label ?? ""}
			width={size === "lg" ? 64 : 40}
			height={size === "lg" ? 64 : 40}
			unoptimized
			className={cn(
				"shrink-0 rounded-md border border-line object-cover",
				size === "lg" ? "size-16" : "size-10",
			)}
		/>
	);
}
