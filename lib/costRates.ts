import { getStaff, monthlyCost } from "./staff";

export type OverheadInputs = {
	/** Monthly costs, in naira. */
	rent: number;
	power: number;
	other: number;
	/** What the non-production team costs a month, from Staff. */
	staffMonthly: number;
	staffCount: number;
	/** Production team size, from Staff. */
	productionCount: number;
	/** Hours each production person works a month. */
	hoursEach: number;
};

export type CostItem = {
	id: string;
	name: string;
	note: string;
	type: "Direct" | "Indirect";
	per: string;
	/** Naira. 0 means "quoted per project". */
	amount: number;
};

/** How many production hours a 3-seater sofa takes, for the overhead example. */
export const SOFA_HOURS = 41;

/**
 * TODO: replace with real figures once Staff and Settings exist.
 * The sample values from the Cost rates design. The page only reads rates
 * through here, so swapping in real data is a one-file change.
 */
export async function getOverheadInputs(): Promise<OverheadInputs> {
	// The team costs and headcounts come from Staff, so the two pages always agree
	const staff = await getStaff();
	const backend = staff.filter((p) => p.team === "Non-production");
	return {
		rent: 1200000,
		power: 650000,
		other: 250000,
		staffMonthly: backend.reduce((sum, p) => sum + monthlyCost(p), 0),
		staffCount: backend.length,
		productionCount: staff.filter((p) => p.team === "Production").length,
		hoursEach: 160,
	};
}

export async function getCostItems(): Promise<CostItem[]> {
	return [
		{
			id: "ci-1",
			name: "Protective wrapping",
			note: "Blankets and stretch film for transport",
			type: "Direct",
			per: "Per piece",
			amount: 4000,
		},
		{
			id: "ci-2",
			name: "Delivery within Lagos",
			note: "Truck, driver and two loaders",
			type: "Direct",
			per: "Per trip",
			amount: 25000,
		},
		{
			id: "ci-3",
			name: "Delivery outside Lagos",
			note: "Ogun, Oyo and Abuja; other states quoted",
			type: "Direct",
			per: "Per trip",
			amount: 80000,
		},
		{
			id: "ci-4",
			name: "Installation and assembly",
			note: "At the client’s site",
			type: "Direct",
			per: "Per visit",
			amount: 15000,
		},
		{
			id: "ci-5",
			name: "Site visit and measurement",
			note: "Before production starts",
			type: "Indirect",
			per: "Per project",
			amount: 10000,
		},
		{
			id: "ci-6",
			name: "Third-party work",
			note: "Glass, stone, metal fabrication or upholstery done outside",
			type: "Direct",
			per: "Per project",
			amount: 0,
		},
	];
}

/** Added to every quote's cost, as a percentage. */
export async function getContingency(): Promise<number> {
	return 5;
}
