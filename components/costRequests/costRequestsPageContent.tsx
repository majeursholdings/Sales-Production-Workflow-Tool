"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
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

/** The request list and the one being reviewed: both read and change the same requests. */
export default function CostRequestsPageContent({
	initialRequests,
	inventory,
	catalog,
	now,
	userName,
}: {
	initialRequests: CostRequest[];
	inventory: Inventory;
	catalog: SupplierCatalog;
	/** ISO date-time, for "3 hours ago". */
	now: string;
	userName: string;
}) {
	const [requests, setRequests] = useState(initialRequests);
	const [filter, setFilter] = useState<ListFilter>("open");
	const [selected, setSelected] = useState<string | null>(
		() =>
			initialRequests.find((r) => r.status === "open")?.id ?? initialRequests[0]?.id ?? null,
	);
	const [focus, setFocus] = useState<string | null>(null);

	// Procurement's choices for every flagged part, kept while switching between requests
	const form = useForm<FixValues>({
		mode: "onTouched",
		defaultValues: fixDefaults(initialRequests, catalog.suppliers[0]?.id ?? ""),
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

	const change = (id: string, update: (r: CostRequest) => CostRequest) =>
		setRequests((list) => list.map((r) => (r.id === id ? update(r) : r)));

	const approve = async (saveAsType: boolean) => {
		if (!current) return;
		const keys = current.parts.flatMap((p) =>
			["cost", "lead"].map((f) => fixKey(current.id, p.id, f)),
		);
		if (!(await form.trigger(keys))) return;
		const cost = reviews[current.id].cost;
		change(current.id, (r) => ({
			...r,
			resolutions: resolutionsFrom(values, r),
			status: "approved",
			approvedBy: userName,
			approvedCost: cost,
		}));
		toast.success(
			`${current.title} approved at ${naira(cost)} cost.${saveAsType ? " Create its furniture type next so it can be quoted from the catalogue." : ""}`,
		);
	};

	const ask = (text: string) => {
		if (!current) return;
		change(current.id, (r) => ({
			...r,
			questions: [...r.questions, { by: userName, text, at: new Date().toISOString() }],
		}));
		toast.success(`Question sent to ${firstName(current.requestedBy)}.`);
	};

	const decline = (reason: string, alternative: string) => {
		if (!current) return;
		change(current.id, (r) => ({
			...r,
			status: "declined",
			declineReason: reason,
			alternative: alternative || null,
		}));
		toast.success(`${current.title} marked can't source.`);
	};

	const reopen = () => {
		if (!current) return;
		change(current.id, (r) => ({
			...r,
			status: "open",
			declineReason: null,
			alternative: null,
		}));
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
						onFocus={setFocus}
						field={field}
						onApprove={approve}
						onAsk={ask}
						onDecline={decline}
						onReopen={reopen}
					/>
				) : (
					<p className="flex-[999_1_640px] rounded-lg border border-line bg-surface p-10 text-center text-body text-fg-secondary">
						No cost requests yet. They arrive here when sales quotes a custom design the
						parts agent can&apos;t fully match.
					</p>
				)}
			</div>
		</>
	);
}
