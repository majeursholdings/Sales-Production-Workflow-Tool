/** Role groups shown as columns in "What each role can do". Customer care and Sales share a column. */
export const MATRIX_ROLE_GROUPS = [
	"MD & GM",
	"Accounting",
	"Customer care & sales",
	"Procurement",
	"Production",
] as const;

const YES = "Yes";
const NO = "—";

type MatrixRow = {
	permission: string;
	/** One entry per MATRIX_ROLE_GROUPS column, in the same order. */
	access: readonly [string, string, string, string, string];
};

/** What each role can do, in plain words. Read-only guide: the real checks live in lib/roles.ts and Postgres RLS. */
export const ROLE_MATRIX: readonly MatrixRow[] = [
	{ permission: "See all quotes", access: [YES, YES, "View only, with creator", NO, NO] },
	{ permission: "Create and send quotes", access: [YES, YES, YES, NO, NO] },
	{ permission: "See part costs and margins", access: [YES, YES, "On their quotes", YES, NO] },
	{ permission: "Edit part costs", access: [YES, YES, NO, YES, NO] },
	{ permission: "Set markups and ceilings", access: [YES, YES, NO, NO, NO] },
	{ permission: "Set VAT and deposit %", access: [YES, YES, NO, NO, NO] },
	{ permission: "Change quote validity", access: [YES, NO, NO, NO, NO] },
	{ permission: "Record deposits and payments", access: [YES, YES, NO, NO, NO] },
	{ permission: "See job cards", access: [YES, NO, NO, "Shortfalls", "Specs and quantities"] },
	{
		permission: "See furniture types",
		access: [YES, NO, "View, with costs", YES, "View, no costs"],
	},
	{ permission: "Add and edit furniture types", access: [YES, NO, NO, YES, "Yes, no costs"] },
	{ permission: "Delete furniture types", access: [YES, NO, NO, NO, YES] },
	{ permission: "See invoices", access: [YES, YES, "For their quotes", NO, NO] },
	{ permission: "Create a new quote version", access: [YES, YES, "Own quotes", NO, NO] },
	{ permission: "Manage people and roles", access: [YES, NO, NO, NO, NO] },
];
