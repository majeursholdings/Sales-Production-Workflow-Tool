"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createJobCardAction, type NewJobCard } from "@/app/(dashboard)/work-orders/actions";
import { Button } from "@/components/common/buttons";
import type { PartOption, QuoteOption } from "@/lib/jobCards";
import NewJobCardDrawer from "./newJobCardDrawer";

/** "New job card", and the drawer it opens. Disabled while no quote has a paid deposit without a job card. */
export default function NewJobCardButton({
	quotes,
	parts,
	today,
}: {
	quotes: QuoteOption[];
	parts: PartOption[];
	today: string;
}) {
	const router = useRouter();
	const [open, setOpen] = useState(false);

	const save = async (card: NewJobCard) => {
		const result = await createJobCardAction(card);
		if (!result.ok) {
			toast.error(result.message);
			return;
		}
		setOpen(false);
		toast.success(
			result.data.short
				? `${result.data.number} started. Some parts are short, so cutting waits on procurement.`
				: `${result.data.number} started and its parts are reserved.`,
		);
		router.push(`/work-orders/${result.data.number}`);
	};

	return (
		<>
			<Button
				variant="primary"
				disabled={quotes.length === 0}
				title={
					quotes.length === 0
						? "No quote has a paid deposit without a job card"
						: undefined
				}
				onClick={() => setOpen(true)}
			>
				<Plus />
				New job card
			</Button>
			{open && (
				<NewJobCardDrawer
					quotes={quotes}
					parts={parts}
					today={today}
					onSave={save}
					onClose={() => setOpen(false)}
				/>
			)}
		</>
	);
}
