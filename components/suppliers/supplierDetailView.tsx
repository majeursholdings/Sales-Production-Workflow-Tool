"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
	FilePlus,
	Mail,
	MapPin,
	MoreVertical,
	Pencil,
	Phone,
	Plus,
	Trash2,
	User,
} from "lucide-react";
import { toast } from "sonner";
import { LinkButton, buttonClasses } from "@/components/common/buttons";
import { Card, CardHeader } from "@/components/common/card";
import { ConfirmDialog } from "@/components/common/modal";
import OverviewCards from "@/components/common/overViewCard";
import PageTitle from "@/components/layout/pageTitle";
import { Menu, MenuItem } from "@/components/tables/menu";
import {
	buildSupplierOverview,
	materialOf,
	offersFor,
	plural,
	type SupplierCatalog,
} from "@/lib/suppliers";
import {
	addSupplierMaterialAction,
	deleteSupplierAction,
	rateSupplierMaterialAction,
	removeSupplierMaterialAction,
	setPreferredSupplierAction,
	updateSupplierAction,
} from "@/app/(dashboard)/suppliers/actions";
import AddMaterialDrawer, { type NewMaterial } from "./addMaterialDrawer";
import CompareSuppliersDrawer from "./compareSuppliersDrawer";
import MaterialViewDrawer from "./materialViewDrawer";
import RateMaterialDrawer, { type RatingDraft } from "./rateMaterialDrawer";
import SupplierDrawer, { type SupplierDetails } from "./supplierDrawer";
import SupplierMaterialsTable from "./supplierMaterialsTable";
import SupplierOrdersTable from "./supplierOrdersTable";

type Drawer =
	| { kind: "view" | "rate" | "compare"; sku: string }
	| { kind: "addMaterial" }
	| { kind: "edit" }
	| null;
type Removing = { kind: "supplier" } | { kind: "material"; sku: string } | null;

const tel = (phone: string) => `tel:${phone.replace(/\s/g, "")}`;

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="flex items-baseline justify-between gap-4 border-t border-line py-2.5 first:border-t-0">
			<dt className="text-small text-fg-secondary">{label}</dt>
			<dd className="text-end text-body text-fg">{children}</dd>
		</div>
	);
}

function ContactLine({ icon, children }: { icon: ReactNode; children: ReactNode }) {
	return (
		<li className="flex items-start gap-2 text-body text-fg-secondary [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-fg-tertiary">
			{icon}
			<span className="min-w-0 [overflow-wrap:anywhere]">{children}</span>
		</li>
	);
}

/**
 * A supplier's page: overview figures, the materials they supply with
 * procurement's ratings, recent orders, and contact, bank and terms. Rating a
 * material or changing who's preferred moves the figures across the page, and
 * comparing reads every supplier, so the whole catalog lives here.
 */
export default function SupplierDetailView({
	catalog,
	supplierId,
}: {
	catalog: SupplierCatalog;
	supplierId: string;
}) {
	const router = useRouter();
	const [drawer, setDrawer] = useState<Drawer>(null);
	const [removing, setRemoving] = useState<Removing>(null);

	const supplier = catalog.suppliers.find((s) => s.id === supplierId)!;
	const link =
		drawer && "sku" in drawer
			? supplier.materials.find((m) => m.sku === drawer.sku)
			: undefined;

	/** Runs a server action; on success closes what's open and confirms, otherwise shows why. */
	const run = async (
		action: Promise<{ ok: true } | { ok: false; message: string }>,
		message: string,
	) => {
		const result = await action;
		if (!result.ok) {
			toast.error(result.message);
			return false;
		}
		setDrawer(null);
		setRemoving(null);
		toast.success(message);
		return true;
	};

	const saveRating = (sku: string, draft: RatingDraft) => {
		const score =
			(draft.ratings.quality + draft.ratings.reliability + draft.ratings.availability) / 3;
		return run(
			rateSupplierMaterialAction(supplierId, sku, draft),
			`Rating saved. ${materialOf(catalog, sku).name} from ${supplier.business} now scores ${score.toFixed(1)}.`,
		);
	};

	const addMaterial = (material: NewMaterial) =>
		run(
			addSupplierMaterialAction(supplierId, material),
			`${materialOf(catalog, material.sku).name} added to ${supplier.business}. Rate it after the first delivery.`,
		);

	const stopBuying = (sku: string) =>
		run(
			removeSupplierMaterialAction(supplierId, sku),
			`Stopped buying ${materialOf(catalog, sku).name.toLowerCase()} from ${supplier.business}.`,
		);

	const saveDetails = (details: SupplierDetails) => {
		const bankChanged =
			details.bankDetails.accountNumber !== supplier.bankDetails.accountNumber ||
			details.bankDetails.bank !== supplier.bankDetails.bank;
		return run(
			updateSupplierAction(supplierId, details),
			bankChanged
				? "Supplier details saved. The bank change was flagged to Accounting to confirm by phone."
				: "Supplier details saved.",
		);
	};

	const { bank, accountNumber, accountName } = supplier.bankDetails;
	const removingSku = removing?.kind === "material" ? removing.sku : null;
	const otherSuppliers = removingSku ? offersFor(catalog, removingSku).length - 1 : 0;

	return (
		<>
			<PageTitle
				breadcrumbs={[
					{ label: "Suppliers", href: "/suppliers" },
					{ label: supplier.business },
				]}
				pageTitle={supplier.business}
				pageDescription={`${supplier.contact} · supplier since ${supplier.since}`}
				actions={
					<Menu
						label={`More actions for ${supplier.business}`}
						triggerClassName={buttonClasses({ icon: true })}
						trigger={<MoreVertical aria-hidden="true" />}
					>
						<MenuItem onSelect={() => window.location.assign(tel(supplier.phone))}>
							<Phone aria-hidden="true" />
							Call {supplier.contact.split(" ")[0]}
						</MenuItem>
						<MenuItem onSelect={() => router.push("/purchase-orders")}>
							<FilePlus aria-hidden="true" />
							New purchase order
						</MenuItem>
						<MenuItem onSelect={() => setDrawer({ kind: "addMaterial" })}>
							<Plus aria-hidden="true" />
							Add material
						</MenuItem>
						<MenuItem onSelect={() => setDrawer({ kind: "edit" })}>
							<Pencil aria-hidden="true" />
							Edit details
						</MenuItem>
						<div role="separator" className="my-1 h-px bg-line" />
						<MenuItem tone="danger" onSelect={() => setRemoving({ kind: "supplier" })}>
							<Trash2 aria-hidden="true" />
							Delete supplier
						</MenuItem>
					</Menu>
				}
			/>

			<OverviewCards
				aria-label={`${supplier.business} overview`}
				items={buildSupplierOverview(catalog, supplier)}
			/>

			<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)] lg:items-start">
				<div className="flex min-w-0 flex-col gap-6">
					<section
						aria-labelledby="supplier-materials-title"
						className="flex flex-col gap-3"
					>
						<SupplierMaterialsTable
							catalog={catalog}
							supplier={supplier}
							onView={(sku) => setDrawer({ kind: "view", sku })}
							header={
								<CardHeader>
									<h2 id="supplier-materials-title" className="flex-1">
										Materials supplied
									</h2>
									<span className="text-small text-fg-tertiary">
										Ratings by procurement, out of 5
									</span>
								</CardHeader>
							}
						/>
						<p className="text-small text-fg-tertiary">
							Score is the average of procurement&apos;s quality, reliability and
							availability ratings. Open a material to see the ratings, rate it or
							compare suppliers. The preferred supplier is suggested first on purchase
							orders and the shortfall list.
						</p>
					</section>

					<section aria-labelledby="supplier-orders-title">
						<SupplierOrdersTable
							orders={supplier.purchaseOrders}
							header={
								<CardHeader>
									<h2 id="supplier-orders-title" className="flex-1">
										Recent purchase orders
									</h2>
									<LinkButton variant="ghost" size="sm" href="/purchase-orders">
										See all
									</LinkButton>
								</CardHeader>
							}
						/>
					</section>
				</div>

				<aside aria-label="Supplier details" className="flex min-w-0 flex-col gap-6">
					<Card aria-labelledby="supplier-contact-title">
						<h2 id="supplier-contact-title">Contact</h2>
						<ul className="flex flex-col gap-2">
							<ContactLine icon={<User aria-hidden="true" />}>
								{supplier.contact}
							</ContactLine>
							<ContactLine icon={<Phone aria-hidden="true" />}>
								<a href={tel(supplier.phone)}>{supplier.phone}</a>
							</ContactLine>
							{supplier.email && (
								<ContactLine icon={<Mail aria-hidden="true" />}>
									<a href={`mailto:${supplier.email}`}>{supplier.email}</a>
								</ContactLine>
							)}
							<ContactLine icon={<MapPin aria-hidden="true" />}>
								{supplier.address}
							</ContactLine>
						</ul>
					</Card>
					<Card aria-labelledby="supplier-bank-title">
						<h2 id="supplier-bank-title">Bank details</h2>
						<dl className="flex flex-col">
							<DetailRow label="Bank">{bank || "Not added"}</DetailRow>
							<DetailRow label="Account">
								<span className="tabular">
									{accountNumber
										? `•••• ${accountNumber.slice(-4)}`
										: "Add before paying"}
								</span>
							</DetailRow>
							<DetailRow label="Account name">{accountName || "—"}</DetailRow>
						</dl>
						<p className="text-small text-fg-tertiary">
							A change is flagged to Accounting, who confirm it by phone before the
							next payment.
						</p>
					</Card>
					<Card aria-labelledby="supplier-notes-title">
						<h2 id="supplier-notes-title">Terms and notes</h2>
						<p className="text-body text-fg-secondary">
							{supplier.notes || "No terms or notes yet."}
						</p>
					</Card>
				</aside>
			</div>

			{drawer?.kind === "view" && link && (
				<MaterialViewDrawer
					catalog={catalog}
					supplier={supplier}
					link={link}
					onRate={() => setDrawer({ kind: "rate", sku: link.sku })}
					onCompare={() => setDrawer({ kind: "compare", sku: link.sku })}
					onStopBuying={() => setRemoving({ kind: "material", sku: link.sku })}
					onClose={() => setDrawer(null)}
				/>
			)}
			{drawer?.kind === "rate" && link && (
				<RateMaterialDrawer
					key={link.sku}
					catalog={catalog}
					supplier={supplier}
					link={link}
					onSave={(draft) => saveRating(link.sku, draft)}
					onClose={() => setDrawer(null)}
				/>
			)}
			{drawer?.kind === "compare" && (
				<CompareSuppliersDrawer
					catalog={catalog}
					sku={drawer.sku}
					currentSupplierId={supplierId}
					onMakePreferred={async (id) => {
						const business = catalog.suppliers.find((s) => s.id === id)?.business;
						const result = await setPreferredSupplierAction(drawer.sku, id);
						if (!result.ok) {
							toast.error(result.message);
							return;
						}
						toast.success(
							`${business} is now the preferred supplier for ${materialOf(catalog, drawer.sku).name.toLowerCase()}.`,
						);
					}}
					onClose={() => setDrawer(null)}
				/>
			)}
			{drawer?.kind === "addMaterial" && (
				<AddMaterialDrawer
					catalog={catalog}
					supplier={supplier}
					onSave={addMaterial}
					onClose={() => setDrawer(null)}
				/>
			)}
			{drawer?.kind === "edit" && (
				<SupplierDrawer
					supplier={supplier}
					onSave={saveDetails}
					onClose={() => setDrawer(null)}
				/>
			)}

			{removing?.kind === "supplier" && (
				<ConfirmDialog
					title={`Delete ${supplier.business}?`}
					confirmLabel="Delete supplier"
					onCancel={() => setRemoving(null)}
					onConfirm={async () => {
						const result = await deleteSupplierAction(supplierId);
						if (!result.ok) {
							toast.error(result.message);
							return;
						}
						toast.success(`${supplier.business} deleted.`);
						router.push("/suppliers");
					}}
				>
					{supplier.business} supplies {plural(supplier.materials.length, "material")} and
					has past purchase orders. Those orders keep its name, but you won&apos;t be able
					to order from it again, and its ratings are removed from comparisons. This
					can&apos;t be undone.
				</ConfirmDialog>
			)}
			{removingSku && (
				<ConfirmDialog
					title={`Stop buying ${materialOf(catalog, removingSku).name.toLowerCase()} from ${supplier.business}?`}
					confirmLabel="Stop buying here"
					onCancel={() => setRemoving(null)}
					onConfirm={() => stopBuying(removingSku)}
				>
					It&apos;s removed from this supplier&apos;s materials and from comparisons.{" "}
					{otherSuppliers
						? `${plural(otherSuppliers, "other supplier")} still ${otherSuppliers === 1 ? "supplies" : "supply"} it.`
						: "No other supplier supplies it, so the shortfall list will have no one to suggest."}{" "}
					Past purchase orders aren&apos;t changed.
				</ConfirmDialog>
			)}
		</>
	);
}
