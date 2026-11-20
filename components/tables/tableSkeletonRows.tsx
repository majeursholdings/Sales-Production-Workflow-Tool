const WIDTHS = ["w-3/4", "w-1/2", "w-2/3", "w-1/3"];

/** Placeholder rows while a table's data loads. */
export function TableSkeletonRows({ cols, rows = 5 }: { cols: number; rows?: number }) {
	return (
		<>
			{Array.from({ length: rows }, (_, r) => (
				<tr key={r} aria-hidden="true">
					{Array.from({ length: cols }, (_, c) => (
						<td key={c}>
							<div
								className={`h-4 animate-pulse rounded-sm bg-subtle ${WIDTHS[(r + c) % WIDTHS.length]}`}
							/>
						</td>
					))}
				</tr>
			))}
		</>
	);
}
