"use client";

import { Suspense, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button, LinkButton } from "@/components/common/buttons";
import { Card } from "@/components/common/card";
import { ConfirmDialog } from "@/components/common/modal";
import OverviewCards, { type OverviewItem } from "@/components/common/overViewCard";
import PageTitle from "@/components/layout/pageTitle";
import { wholeNaira } from "@/lib/quoteBuilder";
import {
	DEFAULT_HOURS,
	PRODUCTION_ROLES,
	monthlyCost,
	type StaffMember,
	type StaffTeam,
} from "@/lib/staff";
import StaffDrawer from "./staffDrawer";
import StaffTable from "./staffTable";
import StaffTableSkeleton from "./staffTableSkeleton";

export const staffTitle = {
	pageTitle: "Staff",
	pageDescription:
		"Everyone on payroll and what an hour of their time costs. Production staff are charged on each piece; the backend team is shared through the workshop overhead.",
};

const sum = (list: StaffMember[]) => list.reduce((total, p) => total + monthlyCost(p), 0);

/**
 * The page title (with "Add staff member"), the overview cards, the table and the
 * side cards all depend on the staff list, so they live together here.
 */
export default function StaffPageContent({ initialStaff }: { initialStaff: StaffMember[] }) {
	// TODO: add, edit and remove through the backend once it exists; for now they only change this page.
	const [staff, setStaff] = useState(initialStaff);
	// null = closed, "new" = adding, otherwise the person being edited
	const [drawer, setDrawer] = useState<StaffMember | "new" | null>(null);
	const [removing, setRemoving] = useState<StaffMember | null>(null);

	const production = staff.filter((p) => p.team === "Production");
	const backend = staff.filter((p) => p.team === "Non-production");
	const rates = production.map((p) => p.rate);
	const hours = production.reduce((total, p) => total + p.hoursPerMonth, 0);

	const overview: OverviewItem[] = [
		{
			label: "Staff",
			value: String(staff.length),
			note: `${production.length} production, ${backend.length} non-production`,
		},
		{
			label: "Payroll cost a month",
			value: wholeNaira(sum(staff)),
			note: `Production ${wholeNaira(sum(production))} · backend ${wholeNaira(sum(backend))}`,
		},
		{
			label: "Average production rate",
			value: rates.length
				? `${wholeNaira(rates.reduce((a, b) => a + b, 0) / rates.length)} /h`
				: "—",
			note: rates.length
				? `Highest ${wholeNaira(Math.max(...rates))}, lowest ${wholeNaira(Math.min(...rates))}`
				: "No production staff",
		},
		{
			label: "Workshop hours a month",
			value: `${hours.toLocaleString("en-NG")} h`,
			note: `${production.length} production staff × ${DEFAULT_HOURS} hours`,
		},
	];

	const roleRates = PRODUCTION_ROLES.map((role) => {
		const people = production.filter((p) => p.role === role);
		return {
			role,
			count: `${people.length} ${people.length === 1 ? "person" : "people"}`,
			rate: people.length
				? wholeNaira(people.reduce((a, p) => a + p.rate, 0) / people.length)
				: "—",
		};
	});

	const editing = drawer && drawer !== "new" ? drawer : undefined;
	const defaultTeam: StaffTeam = "Production";

	return (
		<>
			<PageTitle
				{...staffTitle}
				actions={
					<Button variant="primary" onClick={() => setDrawer("new")}>
						<Plus />
						Add staff member
					</Button>
				}
			/>
			<OverviewCards aria-label="Staff overview" items={overview} />

			<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
				{/* the table keeps its search, filter and page in the URL, which needs Suspense on a static page */}
				<Suspense fallback={<StaffTableSkeleton />}>
					<StaffTable staff={staff} onEdit={setDrawer} />
				</Suspense>

				<aside
					aria-label="Rates and the backend team"
					className="flex min-w-0 flex-col gap-6"
				>
					<Card>
						<h2>Production rates by role</h2>
						<p className="text-small text-fg-tertiary">
							Furniture types list labour hours by role. Each hour is costed at the
							average rate of the people in that role.
						</p>
						<ul className="flex flex-col">
							{roleRates.map((r) => (
								<li
									key={r.role}
									className="flex items-baseline gap-3 border-t border-line py-2.5 first:border-t-0"
								>
									<span className="flex-1 text-body">
										{r.role}{" "}
										<span className="text-small text-fg-tertiary">
											· {r.count}
										</span>
									</span>
									<strong className="whitespace-nowrap tabular">
										{r.rate === "—" ? "—" : `${r.rate}/h`}
									</strong>
								</li>
							))}
						</ul>
					</Card>
					<Card>
						<h2>Backend team</h2>
						<p className="text-body text-fg-secondary">
							{backend.length} people, {wholeNaira(sum(backend))} a month. This goes
							into the workshop overhead with rent and running costs, and is shared
							across production hours.
						</p>
						<LinkButton href="/cost-rates" size="sm" className="self-start">
							See workshop overhead
						</LinkButton>
					</Card>
					<p className="text-small text-fg-tertiary">
						Only Accounting and the MD or GM can see this page. Rates aren&apos;t shown
						anywhere else except as totals on costs.
					</p>
				</aside>
			</div>

			{drawer && (
				<StaffDrawer
					key={editing?.id ?? "new"}
					person={editing}
					defaultTeam={defaultTeam}
					onClose={() => setDrawer(null)}
					onRemove={editing ? () => setRemoving(editing) : undefined}
					onSave={(saved) => {
						setStaff((list) =>
							editing
								? list.map((p) => (p.id === saved.id ? saved : p))
								: [...list, saved],
						);
						setDrawer(null);
						toast.success(
							editing
								? `${saved.name} saved. New quotes use the new rate from today.`
								: `${saved.name} added to staff.`,
						);
					}}
				/>
			)}

			{removing && (
				<ConfirmDialog
					title={`Remove ${removing.name} from staff?`}
					confirmLabel="Remove from staff"
					onCancel={() => setRemoving(null)}
					onConfirm={() => {
						setStaff((list) => list.filter((p) => p.id !== removing.id));
						toast.success(`${removing.name} removed from staff.`);
						setRemoving(null);
						setDrawer(null);
					}}
				>
					Their rate stops counting in labour or overhead costs for new quotes. Quotes
					already sent don&apos;t change, and their past records stay. Their sign-in, if
					they have one, is managed in Team &amp; access.
				</ConfirmDialog>
			)}
		</>
	);
}
