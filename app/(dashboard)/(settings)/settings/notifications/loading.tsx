import { Card } from "@/components/common/card";
import { Table } from "@/components/tables";
import { TableSkeletonRows } from "@/components/tables/tableSkeletonRows";

/** Shown while the notification choices load: the real headers, placeholder rows. */
export default function Loading() {
	return (
		<Card
			flush
			className="overflow-hidden"
			aria-busy="true"
			aria-label="Loading notification choices"
		>
			<Table>
				<thead>
					<tr>
						<th scope="col">Tell me when</th>
						<th scope="col" className="w-24">
							In app
						</th>
						<th scope="col" className="w-24">
							Email
						</th>
					</tr>
				</thead>
				<tbody>
					<TableSkeletonRows cols={3} rows={6} />
				</tbody>
			</Table>
		</Card>
	);
}
