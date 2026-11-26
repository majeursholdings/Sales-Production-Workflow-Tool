"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { saveBuilderQuoteAction } from "@/app/(dashboard)/quotes/actions";
import type { QuoteDraft } from "@/lib/quoteBuilder";
import { updateDraft } from "@/lib/quoteDraft";

/** Why the draft can't be saved yet, or null when it can. */
export function cannotSave(draft: QuoteDraft): string | null {
	if (draft.sent) return "This quote was already sent.";
	if (!draft.client) return "Choose a client first.";
	if (draft.items.length === 0) return "Add at least one furniture item first.";
	return null;
}

/** Saves the draft as a draft quote, or sends it; the saved number and dates go back into the draft. */
export function useSaveQuote() {
	const [saving, startSaving] = useTransition();

	const save = (draft: QuoteDraft, send: boolean, onSaved?: () => void) => {
		const blocked = cannotSave(draft);
		if (blocked || !draft.client) {
			toast.error(blocked ?? "Choose a client first.");
			return;
		}
		const client = draft.client;
		startSaving(async () => {
			const result = await saveBuilderQuoteAction(
				{
					quoteNumber: draft.quoteNumber,
					clientId: client.id,
					items: draft.items,
					qty: draft.qty,
					removedParts: draft.removedParts,
					hours: draft.hours,
					projectCosts: draft.projectCosts,
					discount: draft.discount,
					discountReason: draft.discountReason,
					currency: draft.currency,
				},
				send,
			);
			if (!result.ok) {
				toast.error(result.message);
				return;
			}
			const { quoteNumber, issued, validUntil, status } = result.data;
			updateDraft({
				quoteNumber,
				savedHeader: { number: quoteNumber, issued, validUntil },
				sent: status === "sent",
			});
			toast.success(
				send ? `Quote ${quoteNumber} marked as sent.` : `Draft ${quoteNumber} saved.`,
			);
			onSaved?.();
		});
	};

	return { save, saving };
}
