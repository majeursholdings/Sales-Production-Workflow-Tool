"use client";

import { useSyncExternalStore } from "react";
import type { CompanySettings, SettingsChange } from "./companySettings";

/**
 * Company settings saved in this session, laid over the ones the server sent,
 * so a change made in one settings section shows in the others and in
 * Recent changes. It lives until the page is reloaded.
 * TODO: save through the backend so changes survive a reload.
 */
type Overlay = { patch: Partial<Omit<CompanySettings, "changes">>; changes: SettingsChange[] };

const empty: Overlay = { patch: {}, changes: [] };
let overlay: Overlay = empty;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
	listeners.add(listener);
	return () => listeners.delete(listener);
};

export function useCompanySettings(initial: CompanySettings): CompanySettings {
	const o = useSyncExternalStore(
		subscribe,
		() => overlay,
		() => empty,
	);
	return { ...initial, ...o.patch, changes: [...o.changes, ...initial.changes] };
}

/** Saves part of the settings and logs who changed what. */
export function saveCompanySettings(patch: Overlay["patch"], change: Omit<SettingsChange, "at">) {
	overlay = {
		patch: { ...overlay.patch, ...patch },
		changes: [{ ...change, at: new Date().toISOString() }, ...overlay.changes],
	};
	listeners.forEach((listener) => listener());
}
