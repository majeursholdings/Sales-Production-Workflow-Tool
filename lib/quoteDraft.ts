"use client";

import { useSyncExternalStore } from "react";
import { emptyDraft, type QuoteDraft } from "./quoteBuilder";

/**
 * The quote being built, kept in memory so it carries across the three steps
 * (Client → Items & parts → Review & send). It lives until the page is reloaded;
 * "Save draft" stores it as a draft quote in the database (see saveBuilderQuoteAction),
 * and later saves update that quote.
 */
let draft: QuoteDraft = emptyDraft();
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
	listeners.add(listener);
	return () => listeners.delete(listener);
};
const getDraft = () => draft;
const serverDraft = emptyDraft();

export function useQuoteDraft(): QuoteDraft {
	return useSyncExternalStore(subscribe, getDraft, () => serverDraft);
}

export function updateDraft(
	change: Partial<QuoteDraft> | ((current: QuoteDraft) => Partial<QuoteDraft>),
) {
	draft = { ...draft, ...(typeof change === "function" ? change(draft) : change) };
	listeners.forEach((listener) => listener());
}

export function resetDraft() {
	draft = emptyDraft();
	listeners.forEach((listener) => listener());
}
