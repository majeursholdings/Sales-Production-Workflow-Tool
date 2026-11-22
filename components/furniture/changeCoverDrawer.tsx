"use client";

import { Check } from "lucide-react";
import { Badge } from "@/components/common/badge";
import { Button } from "@/components/common/buttons";
import { Drawer } from "@/components/common/drawer";
import { cn } from "@/lib/cn";
import type { FurnitureCategory } from "@/lib/furnitureTypes";
import TypePhoto from "./typePhoto";

/** Pick which photo is the cover. The first photo is the cover, so choosing one moves it to the front. */
export default function ChangeCoverDrawer({
	typeName,
	category,
	photos,
	onChoose,
	onClose,
}: {
	typeName: string;
	category: FurnitureCategory;
	/** Photo captions, cover first. */
	photos: string[];
	/** Index in `photos` of the one chosen as the new cover. */
	onChoose: (index: number) => void;
	onClose: () => void;
}) {
	return (
		<Drawer
			title={`Change cover for ${typeName.toLowerCase()}`}
			description="The cover is shown when picking items on a quote, on job cards and in Furniture types."
			onClose={onClose}
			footer={
				<>
					<span className="min-w-0 flex-1 text-small text-fg-tertiary">
						These are placeholders until photo upload is connected.
					</span>
					<Button onClick={onClose}>Close</Button>
				</>
			}
		>
			<ul className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
				{photos.map((caption, i) => {
					const isCover = i === 0;
					return (
						<li
							key={caption}
							className={cn(
								"flex flex-col items-center gap-2 rounded-lg border p-3",
								isCover ? "border-accent bg-accent-subtle" : "border-line",
							)}
						>
							<TypePhoto
								category={category}
								size="lg"
								label={`${caption} (placeholder)`}
							/>
							<span className="text-center text-body">{caption}</span>
							{isCover ? (
								<Badge variant="success">Cover</Badge>
							) : (
								<Button size="sm" onClick={() => onChoose(i)}>
									<Check />
									Use as cover
								</Button>
							)}
						</li>
					);
				})}
			</ul>
		</Drawer>
	);
}
