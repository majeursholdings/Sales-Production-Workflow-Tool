"use client";

import { useState } from "react";
import { ImageIcon, Info, Plus } from "lucide-react";
import { LinkButton } from "@/components/common/buttons";
import { Card } from "@/components/common/card";
import PageTitle from "@/components/layout/pageTitle";
import {
	groupTypes,
	type FurnitureAccess,
	type FurnitureCatalog,
	type OtherCostOption,
} from "@/lib/furnitureTypes";
import { furnitureTypesTitle } from "./furnitureTypesTitle";
import TypeEditor from "./typeEditor";
import TypeList from "./typeList";

/** Furniture types: the list on the left, the selected type's template on the right. */
export default function FurnitureTypesView({
	catalog,
	otherCosts,
	access,
}: {
	catalog: FurnitureCatalog;
	otherCosts: OtherCostOption[];
	access: FurnitureAccess;
}) {
	const { categories, types, templates, inventory, rates } = catalog;
	const groups = groupTypes(types, categories);
	const first = groups[0]?.types[0]?.id ?? "";
	const [picked, setPicked] = useState(first);

	// Fall back to the first type when the picked one is gone (deleted, or hidden by RLS)
	const selected = types.find((t) => t.id === picked) ?? types.find((t) => t.id === first);
	const partCounts = Object.fromEntries(
		Object.values(templates).map((t) => [t.typeId, t.parts.length]),
	);
	const covers = Object.fromEntries(
		Object.values(templates).map((t) => [t.typeId, t.photos[0]]),
	);

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

			{types.length === 0 ? (
				<Card className="items-start gap-3">
					<h2>No furniture types yet</h2>
					<p className="text-body text-fg-secondary">
						{access.canEditDetails
							? "Add the first type: its standard parts, hours and costs fill in when someone adds it to a quote."
							: "Furniture types appear here once production, procurement or the MD/GM adds them."}
					</p>
					{access.canEditDetails && (
						<LinkButton href="/furniture-types/new" variant="primary">
							<Plus />
							New furniture type
						</LinkButton>
					)}
				</Card>
			) : (
				<div className="flex flex-wrap items-start gap-6">
					<TypeList
						groups={groups}
						partCounts={partCounts}
						covers={covers}
						selectedId={selected?.id ?? ""}
						onSelect={setPicked}
						showMarkup={access.showCost}
					/>
					{selected && templates[selected.id] && (
						<TypeEditor
							key={selected.id}
							type={selected}
							template={templates[selected.id]}
							categories={categories}
							inventory={inventory}
							rates={rates}
							otherCosts={otherCosts}
							access={access}
							onDeleted={() => setPicked("")}
						/>
					)}
				</div>
			)}
		</>
	);
}
