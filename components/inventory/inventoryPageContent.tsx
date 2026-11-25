"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleAlert, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button, LinkButton } from "@/components/common/buttons";
import { ConfirmDialog } from "@/components/common/modal";
import PageTitle from "@/components/layout/pageTitle";
import {
	qtyLabel,
	shortfallSentence,
	shortfallsOf,
	suggestOrders,
	type Inventory,
	type OrderGroup,
	type Part,
	type Shortfall,
} from "@/lib/inventory";
import { plural, type SupplierCatalog } from "@/lib/suppliers";
import InventoryTable, { INVENTORY_TABLE_ID, toPartRows } from "./inventoryTable";
import InventoryTableSkeleton from "./inventoryTableSkeleton";
import PartDrawer from "./partDrawer";
import RaiseOrdersDrawer from "./raiseOrdersDrawer";

export const inventoryTitle = {
	pageTitle: "Inventory & parts",
	pageDescription:
		"Stock and unit costs that feed every quote. Procurement updates materials; Accounting reviews cost changes.",
};

type Drawer = { kind: "add" } | { kind: "edit"; sku: string } | { kind: "raise" } | null;

/** "2 parts are short for confirmed orders. JC-… (Tunde Bakare) needs a walnut slab and …" */
function ShortfallCallout({
	parts,
	shortfalls,
	onRaise,
}: {
	parts: Part[];
	shortfalls: Shortfall[];
	onRaise: () => void;
}) {
	const skus = new Set(shortfalls.map((s) => s.sku));
	const byJob = Map.groupBy(shortfalls, (s) => s.jobCard);

	return (
		<section
			aria-label="Parts short for job cards"
			className="flex flex-wrap items-center gap-3 rounded-lg border border-warning-line bg-warning-subtle px-4 py-3 text-body text-fg"
		>
			<CircleAlert aria-hidden="true" className="size-5 shrink-0 text-warning-fg" />
			<p className="min-w-0 flex-[1_1_320px]">
				<strong>
					{plural(skus.size, "part")} {skus.size === 1 ? "is" : "are"} short for confirmed
					orders.
				</strong>{" "}
				{[...byJob].map(([job, list]) => (
					<span key={job}>
						<Link href={`/work-orders/${job}`} className="text-fg">
							{job}
						</Link>{" "}
						({list[0].client}) needs {shortfallSentence(parts, list)}.{" "}
					</span>
				))}
			</p>
			<LinkButton
				size="sm"
				href={`/inventory?${INVENTORY_TABLE_ID}_show=short`}
				scroll={false}
			>
				View shortfall list
			</LinkButton>
			<Button size="sm" variant="primary" onClick={onRaise}>
				Raise purchase orders
			</Button>
		</section>
	);
}

/** Title actions, the shortfall callout, the parts table and its drawers: all read and change the same parts. */
export default function InventoryPageContent({
	initialInventory,
	catalog,
	today,
}: {
	initialInventory: Inventory;
	catalog: SupplierCatalog;
	today: string;
}) {
	const router = useRouter();
	const [parts, setParts] = useState(initialInventory.parts);
	const [drawer, setDrawer] = useState<Drawer>(null);
	const [archiving, setArchiving] = useState<Part | null>(null);

	const inventory: Inventory = { parts, demand: initialInventory.demand };
	const shortfalls = shortfallsOf(inventory);
	const rows = toPartRows(inventory, catalog, today);
	const editing = drawer?.kind === "edit" ? parts.find((p) => p.sku === drawer.sku) : undefined;
	const takenSkus = new Set(parts.map((p) => p.sku));

	const save = (part: Part) => {
		const before = parts.find((p) => p.sku === part.sku);
		setParts((list) =>
			before ? list.map((p) => (p.sku === part.sku ? part : p)) : [...list, part],
		);
		setDrawer(null);
		if (!before) {
			toast.success(
				`${part.name} (${part.sku}) added. It can now be used in furniture types and quotes.`,
			);
		} else if (before.unitCost !== part.unitCost) {
			toast.success(`${part.name} updated. Accounting has been notified of the cost change.`);
		} else {
			toast.success(`${part.name} updated.`);
		}
	};

	const archive = (part: Part) => {
		const index = parts.findIndex((p) => p.sku === part.sku);
		setParts((list) => list.filter((p) => p.sku !== part.sku));
		setArchiving(null);
		toast.success(`${part.name} archived.`, {
			action: {
				label: "Undo",
				onClick: () =>
					setParts((list) =>
						list.some((p) => p.sku === part.sku)
							? list
							: [...list.slice(0, index), part, ...list.slice(index)],
					),
			},
		});
	};

	const createDrafts = (groups: OrderGroup[]) => {
		setDrawer(null);
		toast.success(
			`${plural(groups.length, "draft purchase order")} created. Check them and send from Purchase orders.`,
			{ action: { label: "Open", onClick: () => router.push("/purchase-orders") } },
		);
	};

	return (
		<>
			<PageTitle
				{...inventoryTitle}
				actions={
					<>
						<Button
							onClick={() =>
								toast.info("Importing a supplier price list isn't connected yet.")
							}
						>
							Import price list
						</Button>
						<Button variant="primary" onClick={() => setDrawer({ kind: "add" })}>
							<Plus />
							Add part
						</Button>
					</>
				}
			/>

			{shortfalls.length > 0 && (
				<ShortfallCallout
					parts={parts}
					shortfalls={shortfalls}
					onRaise={() => setDrawer({ kind: "raise" })}
				/>
			)}

			{/* the table keeps its search, filters, sort and page in the URL, which needs Suspense on a static page */}
			<Suspense fallback={<InventoryTableSkeleton />}>
				<InventoryTable
					data={rows}
					today={today}
					onEdit={(p) => setDrawer({ kind: "edit", sku: p.sku })}
				/>
			</Suspense>

			{drawer?.kind === "add" && (
				<PartDrawer
					catalog={catalog}
					takenSkus={takenSkus}
					today={today}
					onSave={save}
					onClose={() => setDrawer(null)}
				/>
			)}

			{editing && (
				<PartDrawer
					key={editing.sku}
					part={editing}
					catalog={catalog}
					takenSkus={takenSkus}
					today={today}
					onSave={save}
					onArchive={() => {
						setDrawer(null);
						setArchiving(editing);
					}}
					onClose={() => setDrawer(null)}
				/>
			)}

			{drawer?.kind === "raise" && (
				<RaiseOrdersDrawer
					groups={suggestOrders(inventory, catalog)}
					onCreate={createDrafts}
					onClose={() => setDrawer(null)}
				/>
			)}

			{archiving && (
				<ConfirmDialog
					title={`Archive ${archiving.name}?`}
					confirmLabel="Archive part"
					onConfirm={() => archive(archiving)}
					onCancel={() => setArchiving(null)}
				>
					It won&apos;t be offered when building quotes or furniture types.{" "}
					{archiving.reserved > 0
						? `${qtyLabel(archiving.reserved, archiving.unit)} ${archiving.reserved === 1 ? "is" : "are"} reserved for confirmed job cards; those stay reserved.`
						: "Nothing is reserved against it right now."}
				</ConfirmDialog>
			)}
		</>
	);
}
