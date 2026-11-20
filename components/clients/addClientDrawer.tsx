"use client";

import { Drawer } from "@/components/common/drawer";
import type { Client } from "@/lib/clients";
import ClientForm from "./clientForm";

export default function AddClientDrawer({
	clients,
	onAdd,
	onClose,
}: {
	clients: Client[];
	onAdd: (client: Client) => void;
	onClose: () => void;
}) {
	return (
		<Drawer
			title="Add new client"
			description="We check for duplicates by phone and email as you type."
			onClose={onClose}
		>
			<ClientForm clients={clients} onSubmit={onAdd} onCancel={onClose} />
		</Drawer>
	);
}
