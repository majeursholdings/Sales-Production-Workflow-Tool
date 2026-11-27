import { cn } from "@/lib/cn";

/** Ids of the width, depth and height inputs; the matching measurement lights up while one is focused. */
export const SIZE_INPUT_IDS = {
	width: "design-width",
	depth: "design-depth",
	height: "design-height",
} as const;

// Each class is written out in full so Tailwind finds it.
const lit = {
	width: "group-has-[#design-width:focus]:text-accent-fg group-has-[#design-width:focus]:font-bold",
	depth: "group-has-[#design-depth:focus]:text-accent-fg group-has-[#design-depth:focus]:font-bold",
	height: "group-has-[#design-height:focus]:text-accent-fg group-has-[#design-height:focus]:font-bold",
};

/**
 * A sofa in three-quarter view with its width, depth and height marked. Put it
 * inside a `group` element that also holds the inputs from SIZE_INPUT_IDS.
 */
export default function SizeDiagram({ className }: { className?: string }) {
	const dim = "text-fg-secondary transition-colors";
	return (
		<svg
			viewBox="0 0 290 190"
			role="img"
			aria-label="How to measure: width runs side to side across the front, depth from front to back, and height from the floor to the highest point."
			className={cn("h-auto w-full", className)}
		>
			{/* The sofa: base, backrest, then the arms in front of it */}
			<g className="fill-surface stroke-fg-tertiary" strokeWidth="1.5" strokeLinejoin="round">
				<rect x="27" y="140" width="6" height="8" className="fill-fg-tertiary" />
				<rect x="167" y="140" width="6" height="8" className="fill-fg-tertiary" />
				<rect x="203" y="116" width="6" height="8" className="fill-fg-tertiary" />

				<path d="M20 100 L56 76 L216 76 L180 100 Z" />
				<path d="M20 100 H180 V140 H20 Z" className="fill-subtle" />
				<path d="M180 100 L216 76 V116 L180 140 Z" className="fill-page" />

				<path d="M70 29 H182 V83 H70 Z" className="fill-subtle" />
				<path d="M70 29 L80 22 H192 L182 29 Z" />
				<path d="M182 29 L192 22 V76 L182 83 Z" className="fill-page" />

				<path d="M20 78 L56 54 H80 L44 78 Z" />
				<path d="M44 78 L80 54 V76 L44 100 Z" className="fill-page" />
				<path d="M20 78 H44 V100 H20 Z" className="fill-subtle" />

				<path d="M156 78 L192 54 H216 L180 78 Z" />
				<path d="M180 78 L216 54 V76 L180 100 Z" className="fill-page" />
				<path d="M156 78 H180 V100 H156 Z" className="fill-subtle" />
			</g>

			{/* Width: across the front */}
			<g className={cn(dim, lit.width)}>
				<g stroke="currentColor" strokeWidth="1.5">
					<path d="M20 152 V170 M180 152 V170" strokeDasharray="2 3" />
					<path d="M20 164 H180" />
					<path d="M26 160 L20 164 L26 168 M174 160 L180 164 L174 168" fill="none" />
				</g>
				<text x="100" y="182" textAnchor="middle" fill="currentColor" fontSize="12">
					Width
				</text>
			</g>

			{/* Depth: front to back, along the floor on the right */}
			<g className={cn(dim, lit.depth)}>
				<g stroke="currentColor" strokeWidth="1.5" fill="none">
					<path d="M188 156 L224 132" />
					<path d="M195 155 L188 156 L190 149 M217 133 L224 132 L222 139" />
				</g>
				<text x="212" y="162" fill="currentColor" fontSize="12">
					Depth
				</text>
			</g>

			{/* Height: floor to the top of the back */}
			<g className={cn(dim, lit.height)}>
				<g stroke="currentColor" strokeWidth="1.5" fill="none">
					<path d="M196 22 H250 M220 124 H250" strokeDasharray="2 3" />
					<path d="M244 22 V124" />
					<path d="M240 28 L244 22 L248 28 M240 118 L244 124 L248 118" />
				</g>
				<text x="252" y="77" fill="currentColor" fontSize="12">
					Height
				</text>
			</g>
		</svg>
	);
}
