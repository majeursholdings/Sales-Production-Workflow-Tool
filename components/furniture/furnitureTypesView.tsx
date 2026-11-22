"use client";

import { useState } from "react";
import { ImageIcon, Info, Plus } from "lucide-react";
import { LinkButton } from "@/components/common/buttons";
import PageTitle from "@/components/layout/pageTitle";
import type {
	FurnitureAccess,
	FurnitureCategory,
	FurnitureTemplate,
	FurnitureTypeSummary,
	InventoryPart,
} from "@/lib/furnitureTypes";
import { furnitureTypesTitle } from "./furnitureTypesTitle";
import TypeEditor from "./typeEditor";
import TypeList from "./typeList";

type Group = { category: FurnitureCategory; types: FurnitureTypeSummary[] };

/** Furniture types: the list on the left, the selected type's template on the right. */
export default function FurnitureTypesView({
	groups: initialGroups,
	templates,
	inventory,
	access,
}: {
	groups: Group[];
	templates: Record<string, FurnitureTemplate>;
	inventory: InventoryPart[];
	access: FurnitureAccess;
}) {
	const [groups, setGroups] = useState(initialGroups);
	const [partCounts, setPartCounts] = useState(() =>
		Object.fromEntries(Object.values(templates).map((t) => [t.typeId, t.parts.length])),
	);
	const [selectedId, setSelectedId] = useState(initialGroups[0]?.types[0]?.id ?? "");

	const all = groups.flatMap((g) => g.types);
	const selected = all.find((t) => t.id === selectedId);

	// A saved rename or category change moves the type in the list
	const handleSaved = (saved: FurnitureTypeSummary, partCount: number) => {
		setGroups((current) => {
			const types = current
				.flatMap((g) => g.types)
				.map((t) => (t.id === saved.id ? saved : t));
			return current
				.map((g) => ({ ...g, types: types.filter((t) => t.category === g.category) }))
				.filter((g) => g.types.length > 0);
		});
		setPartCounts((counts) => ({ ...counts, [saved.id]: partCount }));
	};

	return (
		<>
			<PageTitle
				{...furnitureTypesTitle}
				actions={
					<>
						<LinkButton href="/furniture-types/custom-design">
							<ImageIcon />
							Custom design from photo
						</LinkButton>
						{access.canEditDetails && (
							<LinkButton href="/furniture-types/new" variant="primary">
								<Plus />
								New furniture type
							</LinkButton>
						)}
					</>
				}
			/>

			{access.banner && (
				<div
					role="note"
					className="flex items-start gap-3 rounded-md border border-info-line bg-info-subtle px-4 py-3 text-body text-fg"
				>
					<Info aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-info-fg" />
					<span className="flex-1">{access.banner}</span>
				</div>
			)}

			<div className="flex flex-wrap items-start gap-6">
				<TypeList
					groups={groups}
					partCounts={partCounts}
					selectedId={selectedId}
					onSelect={setSelectedId}
					showMarkup={access.showCost}
				/>
				{selected && templates[selected.id] && (
					<TypeEditor
						key={selected.id}
						type={selected}
						template={templates[selected.id]}
						inventory={inventory}
						access={access}
						onSaved={handleSaved}
					/>
				)}
			</div>
		</>
	);
}
