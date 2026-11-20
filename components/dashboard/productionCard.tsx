import Link from "next/link";
import { Badge } from "@/components/common/badge";
import { LinkButton } from "@/components/common/buttons";
import { Card, CardHeader } from "@/components/common/card";
import { Table } from "@/components/tables";
import type { ProductionRow } from "@/lib/dashboard";

/** "In production": the job cards on the workshop floor. */
export default function ProductionCard({ rows }: { rows: ProductionRow[] }) {
	return (
		<Card flush className="overflow-hidden">
			<CardHeader>
				<h2 className="flex-1">In production</h2>
				<LinkButton href="/work-orders" variant="ghost" size="sm">
					All job cards
				</LinkButton>
			</CardHeader>
			<Table className="min-w-130">
				<thead>
					<tr>
						<th scope="col">Job card</th>
						<th scope="col">Items</th>
						<th scope="col">Stage</th>
						<th scope="col">Due</th>
					</tr>
				</thead>
				<tbody>
					{rows.map((row) => (
						<tr key={row.id}>
							<td>
								<span className="flex flex-col">
									{row.href ? (
										<Link
											href={row.href}
											className="font-bold text-fg no-underline hover:underline"
										>
											{row.id}
										</Link>
									) : (
										<span className="font-bold text-fg">{row.id}</span>
									)}
									<span className="text-small text-fg-tertiary">
										{row.client}
									</span>
								</span>
							</td>
							<td>{row.items}</td>
							<td>
								<Badge variant={row.stage.tone}>{row.stage.label}</Badge>
							</td>
							<td className="whitespace-nowrap">{row.due}</td>
						</tr>
					))}
				</tbody>
			</Table>
		</Card>
	);
}
