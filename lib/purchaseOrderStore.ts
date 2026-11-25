"use client";

import { useSyncExternalStore } from "react";
import type { PurchaseOrder } from "./purchaseOrders";

/**
 * Orders created or changed in this session, laid over the ones the server
 * sent, so drafts raised from Inventory or New purchase order show on
 * Purchase orders. It lives until the page is reloaded.
 * TODO: save through the backend so changes survive a reload.
 */
type Overlay = {
	/** Newest first. */
	added: PurchaseOrder[];
	updated: Record<string, PurchaseOrder>;
	deleted: string[];
};

const empty: Overlay = { added: [], updated: {}, deleted: [] };
let overlay: Overlay = empty;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
	listeners.add(listener);
	return () => listeners.delete(listener);
};
const set = (next: Overlay) => {
	overlay = next;
	listeners.forEach((listener) => listener());
};

/** The server's orders with this session's changes applied. */
export function usePurchaseOrders(initial: PurchaseOrder[]): PurchaseOrder[] {
	const o = useSyncExternalStore(
		subscribe,
		() => overlay,
		() => empty,
	);
	const known = new Set(o.added.map((po) => po.number));
	return [...o.added, ...initial.filter((po) => !known.has(po.number))]
		.filter((po) => !o.deleted.includes(po.number))
		.map((po) => o.updated[po.number] ?? po);
}

export function addPurchaseOrders(orders: PurchaseOrder[]) {
	set({ ...overlay, added: [...orders, ...overlay.added] });
}

export function updatePurchaseOrder(order: PurchaseOrder) {
	set({ ...overlay, updated: { ...overlay.updated, [order.number]: order } });
}

export function deletePurchaseOrder(number: string) {
	set({ ...overlay, deleted: [...overlay.deleted, number] });
}
