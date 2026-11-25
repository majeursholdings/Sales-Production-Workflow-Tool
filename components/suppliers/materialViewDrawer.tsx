"use client";

import { Badge } from "@/components/common/badge";
import { Button } from "@/components/common/buttons";
import { Drawer } from "@/components/common/drawer";
import { cn } from "@/lib/cn";
import { wholeNaira } from "@/lib/quoteBuilder";
import {
	compareOffer,
	dateLabel,
	daysLabel,
	formatScore,
	materialOf,
	preferredSupplierId,
	scoreOf,
	type Supplier,
	type SupplierCatalog,
	type SupplierMaterial,
} from "@/lib/suppliers";
import MaterialThumb from "./materialThumb";
import RatingBars from "./ratingBars";

export const lastRatedNote = (link: SupplierMaterial) =>
	link.ratedOn
		? `Last rated ${dateLabel(link.ratedOn)}${link.ratedBy ? ` by ${link.ratedBy}` : ""}`
		: "Not rated yet";

/** One material from one supplier: price and terms, procurement's ratings, and the way to rate or compare. */
export default function MaterialViewDrawer({
	catalog,
	supplier,
	link,
	onRate,
	onCompare,
	onStopBuying,
	onClose,
}: {
	catalog: SupplierCatalog;
	supplier: Supplier;
	link: SupplierMaterial;
	onRate: () => void;
	onCompare: () => void;
	onStopBuying: () => void;
	onClose: () => void;
}) {
	const material = materialOf(catalog, link.sku);
	const cmp = compareOffer(catalog, supplier.id, link.sku);
	const preferred = preferredSupplierId(catalog, link.sku) === supplier.id;

	return (
		<Drawer
			title={`${material.name} from ${supplier.business}`}
			description={`${link.sku} · ${cmp.othersNote}`}
			onClose={onClose}
			footer={
				<>
					<Button variant="ghost" className="text-danger-fg" onClick={onStopBuying}>
						Stop buying here
					</Button>
					<span className="flex-1" />
					<Button onClick={onCompare}>Compare suppliers</Button>
					<Button variant="primary" onClick={onRate}>
						Rate and update price
					</Button>
				</>
			}
		>
			<div className="flex items-center gap-4">
				<MaterialThumb
					sku={link.sku}
					size="lg"
					label={`Photo of ${material.name} (placeholder)`}
				/>
				<div className="flex flex-col gap-1">
					<span className="font-display text-total tabular">
						{formatScore(scoreOf(link.ratings))}{" "}
						<span className="text-body font-normal text-fg-tertiary">/ 5</span>
					</span>
					<span className="text-small text-fg-tertiary">{lastRatedNote(link)}</span>
					{preferred && (
						<span>
							<Badge variant="success">Preferred supplier</Badge>
						</span>
					)}
				</div>
			</div>

			<dl className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-4 rounded-md bg-page p-4">
				<div className="flex flex-col gap-0.5">
					<dt className="text-overline font-bold tracking-[0.06em] text-fg-secondary uppercase">
						Their price
					</dt>
					<dd className="font-bold text-fg tabular">{wholeNaira(link.price)}</dd>
					<dd className="text-small text-fg-tertiary">per {material.unit}</dd>
					<dd
						className={cn(
							"text-small",
							cmp.isLowest ? "text-success-fg" : "text-fg-tertiary",
						)}
					>
						{cmp.priceNote}
					</dd>
				</div>
				<div className="flex flex-col gap-0.5">
					<dt className="text-overline font-bold tracking-[0.06em] text-fg-secondary uppercase">
						Lead time
					</dt>
					<dd className="font-bold text-fg">{daysLabel(link.leadDays)}</dd>
					{cmp.leadNote && (
						<dd
							className={cn(
								"text-small",
								cmp.isFastest ? "text-success-fg" : "text-fg-tertiary",
							)}
						>
							{cmp.leadNote}
						</dd>
					)}
				</div>
				<div className="flex flex-col gap-0.5">
					<dt className="text-overline font-bold tracking-[0.06em] text-fg-secondary uppercase">
						Minimum order
					</dt>
					<dd className="font-bold text-fg">{link.minOrder}</dd>
				</div>
			</dl>

			<section aria-labelledby="material-ratings-title" className="flex flex-col gap-2">
				<h3 id="material-ratings-title" className="text-h3 font-bold">
					Procurement ratings
				</h3>
				{link.ratings ? (
					<RatingBars ratings={link.ratings} />
				) : (
					<p className="text-small text-fg-tertiary">
						Not rated yet. Rate it after the first delivery.
					</p>
				)}
				{link.ratingNote && (
					<p className="rounded-md bg-accent-subtle p-3 text-small text-fg">
						Last delivery: {link.ratingNote}
					</p>
				)}
				<p className="text-small text-fg-tertiary">
					Quality: grade and finish of what arrives. Reliability: delivers on the promised
					date and quantity. Availability: has it in stock when we order.
				</p>
			</section>
			<p className="text-small text-fg-tertiary">
				Past deliveries of this material stay on their purchase orders and can&apos;t be
				deleted.
			</p>
		</Drawer>
	);
}
