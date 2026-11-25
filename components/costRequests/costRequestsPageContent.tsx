"use client";

import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import {
	approveCostRequestAction,
	declineCostRequestAction,
	postCostRequestMessageAction,
	reopenCostRequestAction,
} from "@/app/(dashboard)/cost-requests/actions";
import { FormField } from "@/components/forms";
import type { FormFieldConfig } from "@/components/forms/types";
import PageTitle from "@/components/layout/pageTitle";
import {
	firstName,
	fixDefaults,
	fixKey,
	naira,
	resolutionsFrom,
	reviewOf,
	type CostRequest,
	type DeclineReason,
	type FixValues,
} from "@/lib/costRequests";
import type { Inventory } from "@/lib/inventory";
import type { SupplierCatalog } from "@/lib/suppliers";
import RequestDetail from "./requestDetail";
import RequestList, { type ListFilter } from "./requestList";

export const costRequestsTitle = {
	pageTitle: "Cost requests",
	pageDescription:
		"Custom designs the parts agent couldn't fully match. Check what it flagged, then approve the parts list. Aim to reply within 1 working day.",
};

/** The request list and the one being reviewed. Requests come from the server; actions refresh them. */
export default function CostRequestsPageContent({
	requests,
	inventory,
	catalog,
	now,
}: {
	requests: CostRequest[];
	inventory: Inventory;
	catalog: SupplierCatalog;
	/** ISO date-time, for "3 hours ago". */
	now: string;
}) {
	const [filter, setFilter] = useState<ListFilter>("open");
	const [selected, setSelected] = useState<string | null>(
		() => requests.find((r) => r.status === "open")?.id ?? requests[0]?.id ?? null,
	);
	const [focus, setFocus] = useState<string | null>(null);
	const [pending, startTransition] = useTransition();

	// Procurement's choices for every flagged part, kept while switching between requests.
	// New requests from a refresh get their defaults; choices already made are kept.
	const form = useForm<FixValues>({
		mode: "onTouched",
		values: fixDefaults(requests, catalog.suppliers[0]?.id ?? ""),
		resetOptions: { keepDirtyValues: true },
	});
	const values = useWatch({ control: form.control }) as FixValues;

	const withChoices = (r: CostRequest) =>
		r.status === "open" ? { ...r, resolutions: resolutionsFrom(values, r) } : r;
	const reviews = Object.fromEntries(
		requests.map((r) => [r.id, reviewOf(withChoices(r), inventory)]),
	);
	const current = requests.find((r) => r.id === selected);

	const field = (config: FormFieldConfig) => (
		<FormField
			key={config.name}
			field={config}
			register={form.register}
			control={form.control}
			getValues={form.getValues}
			setValue={form.setValue}
			errors={form.formState.errors}
			hideRequiredMark
		/>
	);

	const approve = async (saveAsType: boolean) => {
		if (!current) return;
		const keys = current.parts.flatMap((p) =>
			["cost", "lead", "category", "unit"].map((f) => fixKey(current.id, p.id, f)),
		);
		if (!(await form.trigger(keys))) return;
		startTransition(async () => {
			const result = await approveCostRequestAction(current.id, {
				resolutions: resolutionsFrom(form.getValues(), current),
				saveAsType,
			});
			if (!result.ok) {
				toast.error(result.message);
				return;
			}
			const added = result.data.addedSkus;
			toast.success(
				`${current.title} approved at ${naira(result.data.cost)} cost.${added.length ? ` Added ${added.join(", ")} to inventory.` : ""}${saveAsType ? " Create its furniture type next so it can be quoted from the catalogue." : ""}`,
			);
		});
	};

	const ask = (text: string) =>
		new Promise<boolean>((resolve) => {
			if (!current) return resolve(false);
			startTransition(async () => {
				const result = await postCostRequestMessageAction(current.id, text);
				if (!result.ok) {
					toast.error(result.message);
					return resolve(false);
				}
				toast.success(`Question sent to ${firstName(current.requestedBy)}.`);
				resolve(true);
			});
		});

	const decline = (reason: DeclineReason, alternative: string) =>
		new Promise<boolean>((resolve) => {
			if (!current) return resolve(false);
			startTransition(async () => {
				const result = await declineCostRequestAction(current.id, { reason, alternative });
				if (!result.ok) {
					toast.error(result.message);
					return resolve(false);
				}
				toast.success(`${current.title} marked can't source.`);
				resolve(true);
			});
		});

	const reopen = () => {
		if (!current) return;
		startTransition(async () => {
			const result = await reopenCostRequestAction(current.id);
			if (!result.ok) {
				toast.error(result.message);
				return;
			}
			toast.success(`${current.title} reopened.`);
		});
	};

	return (
		<>
			<PageTitle {...costRequestsTitle} />
			<div className="flex flex-wrap items-start gap-6">
				<RequestList
					requests={requests}
					reviews={reviews}
					selected={selected}
					filter={filter}
					now={now}
					onFilter={setFilter}
					onSelect={(id) => {
						setSelected(id);
						setFocus(null);
					}}
				/>
				{current ? (
					<RequestDetail
						key={current.id}
						request={current}
						review={reviews[current.id]}
						catalog={catalog}
						now={now}
						focus={focus}
						pending={pending}
						onFocus={setFocus}
						field={field}
						onApprove={approve}
						onAsk={ask}
						onDecline={decline}
						onReopen={reopen}
					/>
				) : (
					<p className="flex-[999_1_640px] rounded-lg border border-line bg-surface p-10 text-center text-body text-fg-secondary">
						{requests.length === 0
							? "No cost requests yet. They arrive here when sales quotes a custom design the parts agent can't fully match."
							: "Pick a request from the list to review it."}
					</p>
				)}
			</div>
		</>
	);
}
