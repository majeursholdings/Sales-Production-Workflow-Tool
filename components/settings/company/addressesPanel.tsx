"use client";

import { useState } from "react";
import { ArrowUpToLine, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/common/badge";
import { Button } from "@/components/common/buttons";
import { ConfirmDialog, Dialog } from "@/components/common/modal";
import { DataTable, IconButton, TableState, type ColumnDef } from "@/components/tables";
import { addressLines, cleanAddress } from "@/lib/address";
import type { CompanyAddress } from "@/lib/companySettings";
import { saveAddressesAction } from "@/app/(dashboard)/(settings)/settings/actions";
import AddressForm from "./addressForm";
import { SettingsCard, useSettingsSave } from "./settingsCard";

/**
 * The company's addresses: one is printed on documents (picked under Company
 * details), and purchase orders can be delivered to any of them, the first by default.
 */
export default function AddressesPanel({
	addresses,
	documentAddressId,
	readOnly,
}: {
	addresses: CompanyAddress[];
	documentAddressId: string;
	readOnly: boolean;
}) {
	const { save, saving } = useSettingsSave();
	/** The address being edited, "new" while adding one, or null. */
	const [editing, setEditing] = useState<CompanyAddress | "new" | null>(null);
	const [removing, setRemoving] = useState<CompanyAddress | null>(null);

	const commit = (next: CompanyAddress[], message: string, after?: () => void) =>
		save(() => saveAddressesAction(next), message, after);

	const columns: ColumnDef<CompanyAddress>[] = [
		{
			key: "name",
			header: "Name",
			className: "w-56",
			cell: (a) => (
				<span className="flex flex-col items-start gap-1">
					<strong className="text-fg">{a.name}</strong>
					{a.id === addresses[0]?.id && <Badge>Default delivery</Badge>}
					{a.id === documentAddressId && <Badge variant="info">On documents</Badge>}
				</span>
			),
		},
		{
			key: "address",
			header: "Address",
			cell: (a) => (
				<span className="flex flex-col text-body">
					{addressLines(a).map((line, i) => (
						<span key={i} className={i === 0 ? "text-fg" : "text-fg-secondary"}>
							{line}
						</span>
					))}
				</span>
			),
		},
		...(readOnly
			? []
			: [
					{
						key: "actions",
						header: <span className="sr-only">Actions</span>,
						className: "w-36 text-end",
						cell: (a: CompanyAddress) => {
							const printed = a.id === documentAddressId;
							return (
								<span className="inline-flex gap-1">
									{a.id !== addresses[0]?.id && (
										<IconButton
											aria-label={`Make ${a.name} the default delivery address`}
											title="Make default delivery address"
											disabled={saving}
											onClick={() =>
												commit(
													[a, ...addresses.filter((x) => x.id !== a.id)],
													`${a.name} is now the default delivery address.`,
												)
											}
										>
											<ArrowUpToLine aria-hidden="true" />
										</IconButton>
									)}
									<IconButton
										aria-label={`Edit ${a.name}`}
										title="Edit address"
										onClick={() => setEditing(a)}
									>
										<Pencil aria-hidden="true" />
									</IconButton>
									<IconButton
										danger
										aria-label={`Remove ${a.name}`}
										title={
											printed
												? "Printed on documents: pick another under Company details first"
												: "Remove address"
										}
										disabled={printed || saving}
										onClick={() => setRemoving(a)}
									>
										<Trash2 aria-hidden="true" />
									</IconButton>
								</span>
							);
						},
					},
				]),
	];

	const current = editing === "new" ? undefined : (editing ?? undefined);

	return (
		<SettingsCard
			readOnly={readOnly}
			title="Addresses"
			description="Your showroom, workshop and anywhere else suppliers deliver to. Pick the one printed on documents under Company details above. The first is the default delivery address on new purchase orders, and orders can also be marked for pickup from the supplier."
		>
			<DataTable
				tableId="company-addresses"
				columns={columns}
				rows={addresses}
				emptyState={
					<TableState
						kind="empty"
						compact
						title="No addresses yet"
						description="Add the showroom, workshop or anywhere else suppliers deliver to."
					/>
				}
			/>
			{!readOnly && (
				<div className="flex justify-end">
					<Button onClick={() => setEditing("new")}>
						<Plus />
						Add address
					</Button>
				</div>
			)}

			{editing && (
				<Dialog
					title={current ? `Edit ${current.name}` : "Add an address"}
					description="The fields follow how the chosen country writes addresses."
					onClose={() => setEditing(null)}
				>
					<AddressForm
						initial={current}
						takenNames={addresses
							.filter((a) => a.id !== current?.id)
							.map((a) => a.name)}
						saving={saving}
						onCancel={() => setEditing(null)}
						onSave={(v) => {
							const saved: CompanyAddress = {
								...cleanAddress(v),
								id: current?.id ?? crypto.randomUUID(),
								name: v.name.trim(),
							};
							const next = current
								? addresses.map((a) => (a.id === current.id ? saved : a))
								: [...addresses, saved];
							commit(
								next,
								current ? `${saved.name} saved.` : `${saved.name} added.`,
								() => setEditing(null),
							);
						}}
					/>
				</Dialog>
			)}

			{removing && (
				<ConfirmDialog
					title={`Remove ${removing.name}?`}
					confirmLabel="Remove address"
					onConfirm={() => {
						commit(
							addresses.filter((a) => a.id !== removing.id),
							`${removing.name} removed.`,
						);
						setRemoving(null);
					}}
					onCancel={() => setRemoving(null)}
				>
					Purchase orders already sent keep it. New orders can&apos;t be delivered there.
				</ConfirmDialog>
			)}
		</SettingsCard>
	);
}
