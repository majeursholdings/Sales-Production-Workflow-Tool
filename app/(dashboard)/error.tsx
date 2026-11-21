"use client";

import { useRouter } from "next/navigation";
import { Card } from "@/components/common/card";
import PageWrapper from "@/components/layout/pageWrapper";
import { TableErrorState } from "@/components/tables";

/**
 * Shown when a page's data can't be loaded (the database is unreachable, the network drops, a query fails).
 * "Try again" re-runs the page's server fetch without a full reload.
 */
export default function DashboardError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	const router = useRouter();

	return (
		<PageWrapper>
			<Card className="py-6">
				<TableErrorState
					error={error}
					onRetry={() => {
						// refetch the page's server data, then clear the error so the page renders again
						router.refresh();
						reset();
					}}
				/>
			</Card>
		</PageWrapper>
	);
}
