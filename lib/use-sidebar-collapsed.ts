"use client";

import { useCallback, useSyncExternalStore } from "react";

const KEY = "majeurs-sidebar";
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
	listeners.add(listener);
	window.addEventListener("storage", listener);
	return () => {
		listeners.delete(listener);
		window.removeEventListener("storage", listener);
	};
}

function getSnapshot() {
	try {
		return localStorage.getItem(KEY) === "collapsed";
	} catch {
		return false;
	}
}

/** Collapsed state persisted in localStorage, shared across components, no effects. */
export function useSidebarCollapsed() {
	const collapsed = useSyncExternalStore(subscribe, getSnapshot, () => false);
	const setCollapsed = useCallback((next: boolean) => {
		try {
			localStorage.setItem(KEY, next ? "collapsed" : "open");
		} catch {}
		listeners.forEach((l) => l());
	}, []);
	return [collapsed, setCollapsed] as const;
}
