"use client";

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonClasses } from "@/components/common/buttons";
import { Card } from "@/components/common/card";
import { ConfirmDialog } from "@/components/common/modal";
import OverviewCards from "@/components/common/overViewCard";
import PageTitle from "@/components/layout/pageTitle";
import { Menu, MenuItem } from "@/components/tables/menu";
import { cn } from "@/lib/cn";
import {
	MACHINE_STATUS,
	buildMachineOverview,
	dateLabel,
	everyLabel,
	sortHistory,
	statusOf,
	type Machine,
	type MaintenanceRecord,
} from "@/lib/machines";
import { wholeNaira } from "@/lib/quoteBuilder";
import LogMaintenanceDrawer, { type MaintenanceDraft } from "./logMaintenanceDrawer";
import MachineDrawer, { type MachineDetails } from "./machineDrawer";
import MachinePhoto from "./machinePhoto";
import MaintenanceTable from "./maintenanceTable";
import MaintenanceTableSkeleton from "./maintenanceTableSkeleton";

type Drawer = { kind: "log"; record?: MaintenanceRecord } | { kind: "edit" } | null;
type Removing = { kind: "machine" } | { kind: "record"; record: MaintenanceRecord } | null;

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className="flex items-baseline justify-between gap-4 border-t border-line py-2.5 first:border-t-0">
			<dt className="text-small text-fg-secondary">{label}</dt>
			<dd className="text-end text-body text-fg">{children}</dd>
		</div>
	);
}

/**
 * A machine's page: title and actions, overview figures, details and the
 * maintenance history. They all change together when maintenance is logged,
 * so they live together here.
 */
export default function MachineDetailView({
	initialMachine,
	today,
	viewer,
}: {
	initialMachine: Machine;
	today: string;
	viewer: { name: string; seesCost: boolean; canDelete: boolean };
}) {
	const router = useRouter();
	const [machine, setMachine] = useState(initialMachine);
	const [drawer, setDrawer] = useState<Drawer>(null);
	const [removing, setRemoving] = useState<Removing>(null);

	const status = statusOf(machine, today);
	const editingRecord = drawer?.kind === "log" ? drawer.record : undefined;

	const saveLog = (draft: MaintenanceDraft) => {
		if (editingRecord) {
			setMachine((m) => ({
				...m,
				history: sortHistory(
					m.history.map((r) => (r.id === editingRecord.id ? { ...r, ...draft } : r)),
				),
			}));
			toast.success("Maintenance record updated.");
		} else {
			const record: MaintenanceRecord = {
				id: crypto.randomUUID(),
				date: draft.date,
				type: draft.type,
				notes: draft.notes,
				doneBy: draft.doneBy,
				loggedBy: viewer.name,
				cost: draft.cost,
				photoCount: 0,
			};
			// A machine that was out of service stays that way until someone says it's working again
			const working = machine.condition === "working" || !!draft.backInService;
			setMachine((m) => ({
				...m,
				history: sortHistory([record, ...m.history]),
				condition: working ? "working" : "out_of_service",
				nextService: working ? (draft.nextService ?? null) : null,
			}));
			toast.success(
				working && draft.nextService
					? `${draft.type} logged for the ${machine.name.toLowerCase()}. Next service due ${dateLabel(draft.nextService)}.`
					: `${draft.type} logged for the ${machine.name.toLowerCase()}.`,
			);
		}
		setDrawer(null);
	};

	const saveDetails = (details: MachineDetails) => {
		setMachine((m) => ({ ...m, ...details }));
		setDrawer(null);
		toast.success(`${details.name} saved.`);
	};

	const alert =
		status === "overdue"
			? {
					tone: "border-warning-line bg-warning-subtle",
					text: `Service was due on ${dateLabel(machine.nextService!)}. Log it once it's done.`,
				}
			: status === "out_of_service"
				? {
						tone: "border-danger-line bg-danger-subtle",
						text: machine.notes || "This machine is out of service.",
					}
				: null;

	return (
		<>
			<PageTitle
				breadcrumbs={[{ label: "Machines", href: "/machines" }, { label: machine.name }]}
				pageTitle={machine.name}
				pageDescription={`${machine.serialNumber} · ${machine.location}`}
				badge={{
					label: MACHINE_STATUS[status].label,
					variant: MACHINE_STATUS[status].tone,
				}}
				actions={
					<>
						<Button variant="primary" onClick={() => setDrawer({ kind: "log" })}>
							<Plus />
							Log maintenance
						</Button>
						<Button onClick={() => setDrawer({ kind: "edit" })}>
							<Pencil />
							Edit details
						</Button>
						{viewer.canDelete && (
							<Menu
								label={`More actions for ${machine.name}`}
								triggerClassName={buttonClasses({ icon: true })}
								trigger={<MoreVertical aria-hidden="true" />}
							>
								<MenuItem
									tone="danger"
									onSelect={() => setRemoving({ kind: "machine" })}
								>
									<Trash2 aria-hidden="true" />
									Delete machine
								</MenuItem>
							</Menu>
						)}
					</>
				}
			/>

			{alert && (
				<div
					role="status"
					className={cn(
						"flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 text-body text-fg",
						alert.tone,
					)}
				>
					<span className="min-w-0 flex-1">{alert.text}</span>
					<Button size="sm" onClick={() => setDrawer({ kind: "log" })}>
						Log maintenance
					</Button>
				</div>
			)}

			<OverviewCards
				aria-label={`${machine.name} overview`}
				items={buildMachineOverview(machine, today)}
			/>

			<div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:items-start">
				<aside aria-label="Machine details" className="flex min-w-0 flex-col gap-6">
					<Card>
						<MachinePhoto
							icon={machine.icon}
							size="lg"
							label={`Photo of the ${machine.name.toLowerCase()} (placeholder)`}
						/>
						<p className="text-small text-fg-tertiary">
							Photo upload isn&apos;t connected yet, so an icon stands in for it.
						</p>
					</Card>
					<Card aria-labelledby="machine-details-title">
						<h2 id="machine-details-title">Details</h2>
						<dl className="flex flex-col">
							<DetailRow label="Serial number">{machine.serialNumber}</DetailRow>
							<DetailRow label="Location">{machine.location}</DetailRow>
							<DetailRow label="Bought">{machine.bought}</DetailRow>
							{viewer.seesCost && (
								<DetailRow label="Hourly cost">
									<strong className="tabular">
										{wholeNaira(machine.hourlyCost)}
									</strong>
								</DetailRow>
							)}
							<DetailRow label="Service every">
								{everyLabel(machine.serviceEveryMonths)}
							</DetailRow>
							<DetailRow label="Used in">{machine.usedIn}</DetailRow>
						</dl>
						{machine.notes && (
							<p className="border-t border-line pt-3 text-small text-fg-secondary">
								{machine.notes}
							</p>
						)}
					</Card>
				</aside>

				<section
					aria-labelledby="maintenance-history-title"
					className="flex min-w-0 flex-col gap-3"
				>
					<h2 id="maintenance-history-title">Maintenance history</h2>
					{/* the table keeps its filter and page in the URL, which needs Suspense on a static page */}
					<Suspense fallback={<MaintenanceTableSkeleton />}>
						<MaintenanceTable
							history={machine.history}
							canDelete={viewer.canDelete}
							permissionNote={
								viewer.canDelete
									? "Production, procurement and the MD or GM can log and edit maintenance. Only the MD or GM can delete records or machines."
									: "You can log and edit maintenance. Only the MD or GM can delete records or machines."
							}
							onEdit={(record) => setDrawer({ kind: "log", record })}
							onDelete={(record) => setRemoving({ kind: "record", record })}
						/>
					</Suspense>
				</section>
			</div>

			{drawer?.kind === "log" && (
				<LogMaintenanceDrawer
					key={editingRecord?.id ?? "new"}
					machine={machine}
					record={editingRecord}
					today={today}
					userName={viewer.name}
					onSave={saveLog}
					onClose={() => setDrawer(null)}
				/>
			)}
			{drawer?.kind === "edit" && (
				<MachineDrawer
					machine={machine}
					seesCost={viewer.seesCost}
					onSave={saveDetails}
					onClose={() => setDrawer(null)}
				/>
			)}

			{removing?.kind === "machine" && (
				<ConfirmDialog
					title={`Delete ${machine.name.toLowerCase()}?`}
					confirmLabel="Delete machine"
					onCancel={() => setRemoving(null)}
					onConfirm={() => {
						toast.success(`${machine.name} deleted.`);
						router.push("/machines");
					}}
				>
					Its photo and {machine.history.length} maintenance{" "}
					{machine.history.length === 1 ? "record are" : "records are"} deleted. Furniture
					types that use it lose its machine time, so their prices drop. This can&apos;t
					be undone.
				</ConfirmDialog>
			)}
			{removing?.kind === "record" && (
				<ConfirmDialog
					title={`Delete the ${removing.record.type.toLowerCase()} on ${dateLabel(removing.record.date)}?`}
					confirmLabel="Delete record"
					onCancel={() => setRemoving(null)}
					onConfirm={() => {
						const id = removing.record.id;
						setMachine((m) => ({
							...m,
							history: m.history.filter((r) => r.id !== id),
						}));
						setRemoving(null);
						toast.success("Record deleted.");
					}}
				>
					It&apos;s removed from the {machine.name.toLowerCase()}&apos;s history. Any
					expense Accounting recorded for it stays. This can&apos;t be undone.
				</ConfirmDialog>
			)}
		</>
	);
}
