"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { Badge } from "@/components/common/badge";
import { Button } from "@/components/common/buttons";
import { FormField } from "@/components/forms";
import type { FormFieldConfig } from "@/components/forms/types";
import { DataTable, IconButton, TableState, type ColumnDef } from "@/components/tables";
import type { DeliveryAddress } from "@/lib/companySettings";
import { saveDeliveryAddressesAction } from "@/app/(dashboard)/(settings)/settings/actions";
import { SaveRow, SettingsCard, useSettingsSave } from "./settingsCard";

type Values = Record<string, string>;
type Row = { id: string; index: number };

const nameKey = (id: string) => `name:${id}`;
const addrKey = (id: string) => `addr:${id}`;

const valuesOf = (list: DeliveryAddress[], ids: string[]): Values =>
	Object.fromEntries(
		list.flatMap((a, i) => [
			[nameKey(ids[i]), a.name],
			[addrKey(ids[i]), a.address],
		]),
	);

/** Where purchase orders can be delivered. Pickup from the supplier is always offered on the order. */
export default function DeliveryAddressesPanel({
	addresses,
	readOnly,
}: {
	addresses: DeliveryAddress[];
	readOnly: boolean;
}) {
	const save = useSettingsSave();
	const [next, setNext] = useState(addresses.length);
	const [ids, setIds] = useState(() => addresses.map((_, i) => String(i)));
	const form = useForm<Values>({ mode: "onTouched", defaultValues: valuesOf(addresses, ids) });

	const field = (config: FormFieldConfig) => (
		<FormField<Values>
			field={{ ...config, id: `delivery-${config.name}`, disabled: readOnly }}
			register={form.register}
			control={form.control}
			getValues={form.getValues}
			setValue={form.setValue}
			errors={form.formState.errors}
			hideRequiredMark
		/>
	);

	const add = () => {
		const id = String(next);
		setNext((n) => n + 1);
		form.setValue(nameKey(id), "");
		form.setValue(addrKey(id), "");
		setIds((list) => [...list, id]);
	};

	const remove = (id: string) => {
		form.unregister([nameKey(id), addrKey(id)]);
		setIds((list) => list.filter((i) => i !== id));
	};

	const columns: ColumnDef<Row>[] = [
		{
			key: "name",
			header: "Name",
			className: "w-56",
			cell: (r) => (
				<span className="flex flex-col gap-1">
					{field({
						name: nameKey(r.id),
						type: "text",
						label: `Address ${r.index + 1} name`,
						hideLabel: true,
						placeholder: "e.g. Workshop",
						validation: {
							validate: (v: string, all: Values) => {
								const name = String(v ?? "")
									.trim()
									.toLowerCase();
								if (!name) return "Give it a name";
								const twice = ids.filter(
									(id) =>
										String(all[nameKey(id)] ?? "")
											.trim()
											.toLowerCase() === name,
								).length;
								return twice < 2 || "Another address has this name";
							},
						},
					})}
					{r.index === 0 && (
						<span>
							<Badge>Default</Badge>
						</span>
					)}
				</span>
			),
		},
		{
			key: "address",
			header: "Address",
			cell: (r) =>
				field({
					name: addrKey(r.id),
					type: "text",
					label: `Address ${r.index + 1}`,
					hideLabel: true,
					placeholder: "e.g. 14 Oba Akran Avenue, Ikeja, Lagos",
				}),
		},
		...(readOnly
			? []
			: [
					{
						key: "remove",
						header: <span className="sr-only">Remove</span>,
						className: "w-12 text-end",
						cell: (r: Row) => (
							<IconButton
								danger
								aria-label={`Remove address ${r.index + 1}`}
								title="Remove address"
								onClick={() => remove(r.id)}
							>
								<Trash2 aria-hidden="true" />
							</IconButton>
						),
					},
				]),
	];

	const submit = (v: Values) => {
		const list = ids.map((id) => ({
			name: String(v[nameKey(id)] ?? "").trim(),
			address: String(v[addrKey(id)] ?? "").trim(),
		}));
		save.save(
			() => saveDeliveryAddressesAction(list),
			"Delivery addresses saved. New purchase orders can use them now.",
			() => form.reset(valuesOf(list, ids)),
		);
	};

	return (
		<SettingsCard
			readOnly={readOnly}
			title="Delivery addresses"
			description="Where suppliers deliver purchase orders. The first one is picked by default on new orders. Orders can also be marked for pickup from the supplier."
		>
			<form noValidate onSubmit={form.handleSubmit(submit)} className="flex flex-col gap-4">
				<DataTable
					tableId="delivery-addresses"
					columns={columns}
					rows={ids.map((id, index) => ({ id, index }))}
					emptyState={
						<TableState
							kind="empty"
							compact
							title="No delivery addresses yet"
							description="Add the workshop, showroom or anywhere else suppliers deliver to."
						/>
					}
				/>
				{!readOnly && (
					<SaveRow
						saving={save.saving}
						extra={
							<Button onClick={add}>
								<Plus />
								Add address
							</Button>
						}
					/>
				)}
			</form>
		</SettingsCard>
	);
}
