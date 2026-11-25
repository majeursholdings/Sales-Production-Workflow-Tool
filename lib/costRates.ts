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
