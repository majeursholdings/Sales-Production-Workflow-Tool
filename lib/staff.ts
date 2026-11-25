export type StaffTeam = "Production" | "Non-production";

export type StaffMember = {
	id: string;
	name: string;
	/** Their role, e.g. "Carpenter". */
	role: string;
	team: StaffTeam;
	phone: string;
	email: string;
	/** Hourly rate in naira: pay plus pension and allowances. */
	rate: number;
	hoursPerMonth: number;
	notes: string;
};

export const PRODUCTION_ROLES = [
	"Carpenter",
	"Upholsterer",
	"Finisher",
	"Metal worker",
	"Workshop assistant",
	"Production lead",
];
export const NON_PRODUCTION_ROLES = [
	"Managing Director",
	"General Manager",
	"Accountant",
	"Procurement lead",
	"Customer care",
	"Sales",
	"Facility officer",
	"Security",
	"Driver",
];

export const DEFAULT_HOURS = 160;
export const monthlyCost = (p: Pick<StaffMember, "rate" | "hoursPerMonth">) =>
	p.rate * p.hoursPerMonth;
