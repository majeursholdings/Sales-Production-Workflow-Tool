import { Card, CardHeader, CardTitle } from "@/components/common/card";
import { Table } from "@/components/tables";
import { MATRIX_ROLE_GROUPS, ROLE_MATRIX } from "@/lib/rolePermissionMatrix";

/** "What each role can do": a read-only grid of permissions by role. */
export default function RolePermissionsCard() {
	return (
		<Card flush className="overflow-hidden">
			<CardHeader>
				<CardTitle className="flex-1">What each role can do</CardTitle>
				<span className="text-small text-fg-tertiary">
					Every pricing change is recorded in Pricing &amp; margins history
				</span>
			</CardHeader>
			<Table className="min-w-225 [&_td]:text-center [&_td:first-child]:text-start [&_th]:text-center [&_th:first-child]:text-start">
				<thead>
					<tr>
						<th scope="col">Permission</th>
						{MATRIX_ROLE_GROUPS.map((group) => (
							<th key={group} scope="col">
								{group}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{ROLE_MATRIX.map((row) => (
						<tr key={row.permission}>
							<td className="font-bold text-fg">{row.permission}</td>
							{row.access.map((value, i) => (
								<td key={MATRIX_ROLE_GROUPS[i]}>
									{value === "—" ? (
										<>
											<span aria-hidden="true">—</span>
											<span className="sr-only">No access</span>
										</>
									) : (
										value
									)}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</Table>
		</Card>
	);
}
