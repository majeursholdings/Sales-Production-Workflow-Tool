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

const person = (
	id: string,
	name: string,
	role: string,
	team: StaffTeam,
	rate: number,
	phone: string,
	emailName: string,
): StaffMember => ({
	id,
	name,
	role,
	team,
	rate,
	phone,
	email: `${emailName}@majeursholdings.com`,
	hoursPerMonth: DEFAULT_HOURS,
	notes: "",
});

/**
 * TODO: replace with real staff once there's a backend.
 * The sample staff from the design. The pages only read staff through here,
 * so swapping in real data is a one-file change.
 */
const STAFF: StaffMember[] = [
	person(
		"p1",
		"Tobi Adekunle",
		"Production lead",
		"Production",
		3500,
		"+234 803 000 0007",
		"tobi.adekunle",
	),
	person(
		"p2",
		"Babatunde Afolabi",
		"Carpenter",
		"Production",
		2900,
		"+234 806 214 7730",
		"babatunde.afolabi",
	),
	person(
		"p3",
		"Emeka Nwachukwu",
		"Carpenter",
		"Production",
		2300,
		"+234 813 552 1904",
		"emeka.nwachukwu",
	),
	person(
		"p4",
		"Yusuf Garba",
		"Carpenter",
		"Production",
		2300,
		"+234 802 778 4410",
		"yusuf.garba",
	),
	person(
		"p5",
		"Blessing Okoro",
		"Upholsterer",
		"Production",
		3200,
		"+234 805 990 2216",
		"blessing.okoro",
	),
	person(
		"p6",
		"Kunle Adeyemi",
		"Upholsterer",
		"Production",
		2800,
		"+234 816 340 1157",
		"kunle.adeyemi",
	),
	person("p7", "Samuel Etim", "Finisher", "Production", 2200, "+234 809 112 6638", "samuel.etim"),
	person(
		"p8",
		"Ibrahim Musa",
		"Metal worker",
		"Production",
		2800,
		"+234 803 667 2290",
		"ibrahim.musa",
	),
	person(
		"p9",
		"Daniel Obi",
		"Workshop assistant",
		"Production",
		1500,
		"+234 814 220 5501",
		"daniel.obi",
	),
	person(
		"p10",
		"Peter Udo",
		"Workshop assistant",
		"Production",
		1500,
		"+234 807 331 9046",
		"peter.udo",
	),
	person(
		"n1",
		"Femi Ogunleye",
		"Managing Director",
		"Non-production",
		6000,
		"+234 803 000 0001",
		"femi.ogunleye",
	),
	person(
		"n2",
		"Amaka Udeh",
		"General Manager",
		"Non-production",
		4500,
		"+234 803 000 0002",
		"amaka.udeh",
	),
	person(
		"n3",
		"Bisi Lawal",
		"Accountant",
		"Non-production",
		3400,
		"+234 803 000 0003",
		"bisi.lawal",
	),
	person(
		"n4",
		"Ifeanyi Nwosu",
		"Procurement lead",
		"Non-production",
		2800,
		"+234 803 000 0005",
		"ifeanyi.nwosu",
	),
	person(
		"n5",
		"Chiamaka Eze",
		"Customer care",
		"Non-production",
		2000,
		"+234 803 000 1122",
		"chiamaka.eze",
	),
	person("n6", "Emeka Obi", "Sales", "Non-production", 2000, "+234 803 000 1133", "emeka.obi"),
	person(
		"n7",
		"Grace Ali",
		"Facility officer",
		"Non-production",
		1500,
		"+234 811 450 3378",
		"grace.ali",
	),
	person("n8", "Musa Bello", "Driver", "Non-production", 1400, "+234 810 902 6615", "musa.bello"),
];

export async function getStaff(): Promise<StaffMember[]> {
	return STAFF;
}
