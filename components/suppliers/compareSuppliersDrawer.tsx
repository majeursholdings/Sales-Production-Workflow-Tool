"use client";

import { Badge, type BadgeVariant } from "@/components/common/badge";
import { Button, LinkButton } from "@/components/common/buttons";
import { Drawer } from "@/components/common/drawer";
import { cn } from "@/lib/cn";
import { wholeNaira } from "@/lib/quoteBuilder";
import {
	formatScore,
	materialOf,
	offersFor,
	plural,
	preferredSupplierId,
	type SupplierCatalog,
} from "@/lib/suppliers";
import RatingBars from "./ratingBars";

/** Every supplier of one material side by side, best score first, with the way to change who's preferred. */
export default function CompareSuppliersDrawer({
	catalog,
	sku,
	currentSupplierId,
	onMakePreferred,
	onClose,
}: {
	catalog: SupplierCatalog;
	sku: string;
	/** The supplier whose page this opened from. */
	currentSupplierId: string;
	onMakePreferred: (supplierId: string) => void;
	onClose: () => void;
}) {
	const material = materialOf(sku);
	const offers = offersFor(catalog, sku);
	const preferredId = preferredSupplierId(catalog, sku);
	const count = offers.length;
	const lowest = Math.min(...offers.map((o) => o.price));
	const fastest = Math.min(...offers.map((o) => o.leadDays));

	return (
		<Drawer
			title={`Suppliers of ${material.name.toLowerCase()}`}
			description={`${plural(count, "supplier")}, best score first. The preferred one is suggested first on purchase orders.`}
			onClose={onClose}
			footer={
				<>
					<span className="flex-1" />
					<Button onClick={onClose}>Close</Button>
				</>
			}
		>
			<ul className="flex flex-col gap-3">
				{offers.map((o, i) => {
					const preferred = o.supplier.id === preferredId;
					const tags: { label: string; tone: BadgeVariant }[] = [];
					if (preferred) tags.push({ label: "Preferred", tone: "success" });
					if (count > 1 && i === 0 && o.score !== null)
						tags.push({ label: "Best score", tone: "info" });
					if (count > 1 && o.price === lowest)
						tags.push({ label: "Lowest price", tone: "neutral" });
					if (count > 1 && o.leadDays === fastest)
						tags.push({ label: "Fastest", tone: "neutral" });
					const isCurrent = o.supplier.id === currentSupplierId;

					return (
						<li
							key={o.supplier.id}
							aria-label={o.supplier.business}
							className={cn(
								"flex flex-col gap-3 rounded-md border p-4",
								preferred ? "border-2 border-accent p-[15px]" : "border-line",
							)}
						>
							<div className="flex flex-wrap items-start gap-3">
								<span className="flex min-w-48 flex-1 flex-col gap-0.5">
									<strong className="text-fg">{o.supplier.business}</strong>
									<span className="text-small text-fg-tertiary">
										{o.supplier.onTimePercent}% on time overall
									</span>
								</span>
								<span className="flex flex-col items-end">
									<span className="font-display text-h2 tabular">
										{formatScore(o.score)}
									</span>
									<span className="text-small text-fg-tertiary">score</span>
								</span>
							</div>
							{tags.length > 0 && (
								<div className="flex flex-wrap gap-1.5">
									{tags.map((t) => (
										<Badge key={t.label} variant={t.tone}>
											{t.label}
										</Badge>
									))}
								</div>
							)}
							<dl className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-3 text-body">
								<div>
									<dt className="text-overline font-bold tracking-[0.06em] text-fg-secondary uppercase">
										Price
									</dt>
									<dd>
										<strong className="tabular">{wholeNaira(o.price)}</strong>{" "}
										<span className="text-small text-fg-tertiary">
											per {material.unit}
										</span>
									</dd>
								</div>
								<div>
									<dt className="text-overline font-bold tracking-[0.06em] text-fg-secondary uppercase">
										Lead time
									</dt>
									<dd className="font-bold">
										{plural(o.leadDays, "working day")}
									</dd>
								</div>
								<div>
									<dt className="text-overline font-bold tracking-[0.06em] text-fg-secondary uppercase">
										Min. order
									</dt>
									<dd>{o.minOrder}</dd>
								</div>
							</dl>
							{o.ratings ? (
								<RatingBars ratings={o.ratings} />
							) : (
								<p className="text-small text-fg-tertiary">Not rated yet.</p>
							)}
							<div className="flex flex-wrap items-center gap-3">
								{!preferred && (
									<Button
										size="sm"
										onClick={() => onMakePreferred(o.supplier.id)}
									>
										Make preferred
									</Button>
								)}
								{isCurrent ? (
									<span className="text-small text-fg-tertiary">
										You&apos;re on this supplier&apos;s page.
									</span>
								) : (
									<LinkButton
										size="sm"
										variant="ghost"
										href={`/suppliers/${o.supplier.id}`}
									>
										Open {o.supplier.business}
									</LinkButton>
								)}
							</div>
						</li>
					);
				})}
			</ul>
		</Drawer>
	);
}
