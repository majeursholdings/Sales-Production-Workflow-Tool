"use client";

import { toast } from "sonner";
import {
	AvatarCell,
	DataTable,
	ExportMenu,
	StatusBadge,
	TableToolbar,
	exportRows,
	useTableRows,
	type ColumnDef,
	type ExportColumn,
	type ExportFormat,
} from "@/components/tables";
import { formatNaira } from "@/lib/currency";
import type { Client } from "@/lib/clients";

const exportColumns: ExportColumn<Client>[] = [
	{ header: "Name", value: (c) => c.name },
	{ header: "Phone and email", value: (c) => c.contact },
	{ header: "Type", value: (c) => c.type },
	{ header: "Company", value: (c) => c.company },
	{ header: "Trade tier", value: (c) => c.tier },
	{ header: "Location", value: (c) => c.location },
	{ header: "Source", value: (c) => c.source },
	{ header: "Quotes", value: (c) => c.quotes, kind: "number" },
	{ header: "Total spent (₦)", value: (c) => c.spent, kind: "money" },
	{ header: "Last activity", value: (c) => c.last, skipInPdf: true },
];

export const clientColumns: ColumnDef<Client>[] = [
	{
		key: "client",
		header: "Client",
		cell: (c) => <AvatarCell name={c.name} subtitle={c.contact} detail={c.location} />,
	},
	{
		key: "type",
		header: "Type",
		cell: (c) => (
			<span className="flex flex-col items-start gap-1">
				<StatusBadge tone={c.type === "Trade" ? "info" : "neutral"}>{c.type}</StatusBadge>
				{c.company && <span className="text-small text-fg-tertiary">{c.company}</span>}
				{c.tier && <span className="text-small text-fg-tertiary">{c.tier}</span>}
			</span>
		),
	},
	{
		key: "spent",
		header: "Spent",
		className: "text-end",
		cell: (c) => (
			<span className="flex flex-col">
				<span className="font-bold whitespace-nowrap text-fg tabular">
					{c.spent > 0 ? formatNaira(c.spent) : "—"}
				</span>
				<span className="text-small whitespace-nowrap text-fg-tertiary">
					{c.quotes} {c.quotes === 1 ? "quote" : "quotes"} · {c.last}
				</span>
			</span>
		),
	},
];

/** What the eye icon opens: everything we hold on a client. */
function ClientDetails({ client: c }: { client: Client }) {
	const rows: [string, string][] = [
		["Phone and email", c.contact],
		["Type", c.type],
		...(c.company ? ([["Company", c.company]] as [string, string][]) : []),
		...(c.tier ? ([["Trade tier", c.tier]] as [string, string][]) : []),
		["Location", c.location || "—"],
		["Came to Majeurs through", c.source],
		["Quotes", String(c.quotes)],
		["Total spent", c.spent > 0 ? formatNaira(c.spent) : "—"],
		["Last activity", c.last],
	];
	return (
		<dl className="flex flex-col">
			{rows.map(([label, value]) => (
				<div
					key={label}
					className="flex flex-col gap-0.5 border-b border-line py-3 first:pt-0 last:border-b-0"
				>
					<dt className="text-small text-fg-tertiary">{label}</dt>
					<dd className="text-body text-fg">{value}</dd>
				</div>
			))}
		</dl>
	);
}

export default function ClientsTable({
	clients,
	canDelete,
	onDelete,
}: {
	clients: Client[];
	/** Only admins (MD or GM) can delete a client. */
	canDelete: boolean;
	onDelete: (client: Client) => void;
}) {
	const { rows, pagination } = useTableRows({
		tableId: "clients",
		data: clients,
		searchFields: ["name", "contact", "company", "location"],
		filters: [{ paramKey: "type", field: "type" }],
		sortOptions: [
			{ value: "spent", field: "spent", type: "number", direction: "desc" },
			{ value: "name", field: "name", type: "string", direction: "asc" },
		],
		rowsPerPage: 10,
	});

	const count = (type?: Client["type"]) => clients.filter((c) => !type || c.type === type).length;

	const exportClients = async (format: ExportFormat) => {
		await exportRows(clients, exportColumns, {
			format,
			filename: `clients-${new Date().toISOString().slice(0, 10)}`,
			title: "Clients",
		});
		toast.success(`Exported ${clients.length} clients.`);
	};

	return (
		<>
			<DataTable
				tableId="clients"
				columns={clientColumns}
				rows={rows}
				pagination={pagination}
				emptyMessage="No clients match your search. Try a different name, phone or email."
				toolbar={
					<TableToolbar
						search={{ placeholder: "Name, phone or email" }}
						filters={[
							{
								title: "Type",
								paramKey: "type",
								items: [
									{
										label: `Individuals (${count("Individual")})`,
										value: "Individual",
									},
									{ label: `Trade (${count("Trade")})`, value: "Trade" },
								],
							},
						]}
						sortBy={{
							title: "Sort by",
							placeholder: "Recent activity",
							items: [
								{ label: "Total spent, highest first", value: "spent" },
								{ label: "Name, A to Z", value: "name" },
							],
						}}
						actions={
							<ExportMenu onExport={exportClients} disabled={clients.length === 0} />
						}
					/>
				}
				viewAction={{
					type: "sheet",
					title: (c) => c.name,
					content: (c) => <ClientDetails client={c} />,
				}}
				deleteAction={
					canDelete
						? {
								dataType: "client",
								dialogContent: (c) => (
									<p className="text-body text-fg-secondary">
										{c.quotes > 0
											? `Their ${c.quotes} ${c.quotes === 1 ? "quote stays" : "quotes stay"} in the records under their name for accounting. `
											: ""}
										{c.name} will be removed from client lists, search and
										birthday reminders. This can&apos;t be undone.
									</p>
								),
								onConfirm: onDelete,
							}
						: undefined
				}
			/>
		</>
	);
}
