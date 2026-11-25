"use client";

import { Suspense, useState } from "react";
import dayjs from "dayjs";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { LinkButton } from "@/components/common/buttons";
import { ConfirmDialog } from "@/components/common/modal";
import PageTitle from "@/components/layout/pageTitle";
import type { Inventory } from "@/lib/inventory";
import {
	addPurchaseOrders,
	deletePurchaseOrder,
	updatePurchaseOrder,
	usePurchaseOrders,
} from "@/lib/purchaseOrderStore";
import {
	APPROVERS_BOTH,
	addWorkingDays,
	draftsFromGroups,
	needsApproval,
	poTotal,
	skusOnOrder,
	type DeliveryQuality,
	type PurchaseOrder,
} from "@/lib/purchaseOrders";
import { offersFor, plural, type SupplierCatalog } from "@/lib/suppliers";
import PurchaseOrderDrawer from "./purchaseOrderDrawer";
import PurchaseOrdersTable, { toPORows } from "./purchaseOrdersTable";
import PurchaseOrdersTableSkeleton from "./purchaseOrdersTableSkeleton";
import ShortfallSuggestions, {
	shortfallSuggestions,
	suggestionGroups,
} from "./shortfallSuggestions";

export const purchaseOrdersTitle = {
	pageTitle: "Purchase orders",
	pageDescription:
		"What we've ordered from suppliers. Orders over ₦1,000,000 need MD or GM approval before they're sent.",
};

/** Suggestions, the orders table and an order's drawer: all read and change the same orders. */
export default function PurchaseOrdersPageContent({
	initialOrders,
	inventory,
	catalog,
	today,
	userName,
	canApprove,
}: {
	initialOrders: PurchaseOrder[];
	inventory: Inventory;
	catalog: SupplierCatalog;
	today: string;
	userName: string;
	canApprove: boolean;
}) {
	const orders = usePurchaseOrders(initialOrders);
	const [open, setOpen] = useState<string | null>(null);
	const [deleting, setDeleting] = useState<PurchaseOrder | null>(null);

	const suggestions = shortfallSuggestions(inventory, catalog, skusOnOrder(orders));
	const current = orders.find((po) => po.number === open);
	const supplierOf = (po: PurchaseOrder) => catalog.suppliers.find((s) => s.id === po.supplierId);
	const supplierName = (po: PurchaseOrder) => supplierOf(po)?.business ?? "the supplier";

	/** The expected date from the slowest line's lead time with this supplier. */
	const expectedFor = (po: PurchaseOrder) => {
		const lead = Math.max(
			0,
			...po.lines.map(
				(l) =>
					offersFor(catalog, l.sku).find((o) => o.supplier.id === po.supplierId)
						?.leadDays ?? 0,
			),
		);
		return addWorkingDays(today, lead || 5);
	};

	const createDrafts = () => {
		const drafts = draftsFromGroups(suggestionGroups(suggestions), {
			inventory,
			taken: new Set(orders.map((po) => po.number)),
			raisedBy: userName,
			today,
		});
		addPurchaseOrders(drafts);
		toast.success(
			`${plural(drafts.length, "draft order")} created. Check quantities, then send them from each order.`,
		);
	};

	const send = (po: PurchaseOrder) => {
		setOpen(null);
		if (needsApproval(poTotal(po))) {
			updatePurchaseOrder({
				...po,
				status: "approval",
				approvalRequested: dayjs().format("D MMM, HH:mm"),
			});
			toast.success(
				`Sent to ${APPROVERS_BOTH} for approval. ${supplierName(po)} gets it once approved.`,
			);
			return;
		}
		updatePurchaseOrder({ ...po, status: "sent", expected: po.expected ?? expectedFor(po) });
		toast.success(`${po.number} marked as sent to ${supplierName(po)}.`);
	};

	const approve = (po: PurchaseOrder) => {
		setOpen(null);
		updatePurchaseOrder({ ...po, status: "sent", expected: po.expected ?? expectedFor(po) });
		toast.success(`${po.number} approved and marked as sent to ${supplierName(po)}.`);
	};

	const recordDelivery = (
		po: PurchaseOrder,
		received: Record<string, number>,
		date: string,
		quality: DeliveryQuality,
	) => {
		const lines = po.lines.map((l) => ({
			...l,
			received: l.received + (received[l.sku] ?? 0),
		}));
		const done = lines.every((l) => l.received >= l.ordered);
		updatePurchaseOrder({
			...po,
			lines,
			status: done ? "received" : "part",
			deliveredOn: date,
			quality,
		});
		setOpen(null);
		toast.success(
			done
				? `Delivery recorded on ${po.number}. Everything ordered has arrived.`
				: `Delivery recorded on ${po.number}. The rest is still to come.`,
		);
	};

	const remove = (po: PurchaseOrder) => {
		deletePurchaseOrder(po.number);
		setDeleting(null);
		setOpen(null);
		toast.success(`Draft ${po.number} deleted.`);
	};

	return (
		<>
			<PageTitle
				{...purchaseOrdersTitle}
				actions={
					<LinkButton variant="primary" href="/purchase-orders/new">
						<Plus />
						New purchase order
					</LinkButton>
				}
			/>

			{suggestions.length > 0 && (
				<ShortfallSuggestions suggestions={suggestions} onCreate={createDrafts} />
			)}

			{/* the table keeps its search, filter, sort and page in the URL, which needs Suspense on a static page */}
			<Suspense fallback={<PurchaseOrdersTableSkeleton />}>
				<PurchaseOrdersTable
					data={toPORows(orders, catalog)}
					today={today}
					onOpen={(po) => setOpen(po.number)}
				/>
			</Suspense>

			{current && (
				<PurchaseOrderDrawer
					key={`${current.number}-${current.status}`}
					po={current}
					supplier={supplierOf(current)}
					today={today}
					canApprove={canApprove}
					onSend={() => send(current)}
					onApprove={() => approve(current)}
					onRecordDelivery={(received, date, quality) =>
						recordDelivery(current, received, date, quality)
					}
					onDelete={() => setDeleting(current)}
					onClose={() => setOpen(null)}
				/>
			)}

			{deleting && (
				<ConfirmDialog
					title={`Delete draft ${deleting.number}?`}
					confirmLabel="Delete draft"
					onConfirm={() => remove(deleting)}
					onCancel={() => setDeleting(null)}
				>
					The draft order to {supplierName(deleting)} was never sent. Its parts go back on
					the shortfall list. This can&apos;t be undone.
				</ConfirmDialog>
			)}
		</>
	);
}
