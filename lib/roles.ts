export const APP_ROLES = [
	"md",
	"gm",
	"accounting",
	"procurement",
	"production",
	"sales",
	"customer_care",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const ROLE_LABELS: Record<AppRole, string> = {
	md: "Managing Director",
	gm: "General Manager",
	accounting: "Accounting",
	procurement: "Procurement",
	production: "Production",
	sales: "Sales",
	customer_care: "Customer care",
};

export const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
	md: "Superadmin. Full access to all modules, pricing, team & access, and company settings.",
	gm: "Superadmin. Full access to all modules, pricing, team & access, and company settings.",
	accounting: "Pricing rules, cost rates, staff payroll, invoices, payments, and audit logs.",
	procurement:
		"Materials, suppliers, stock receiving, purchase orders, custom cost requests, and adding or editing furniture templates.",
	production: "Job cards, furniture templates (add, edit, delete), machines, and stock quantities (no prices).",
	sales: "Build and send quotes, manage clients, and view furniture templates.",
	customer_care: "Build and send quotes, manage clients, and view furniture templates.",
};

export const APP_PERMISSIONS = [
	"users.manage",
	"materials.view",
	"materials.view_prices",
	"materials.edit",
	"templates.view",
	"templates.edit",
	"templates.delete",
	"pricing_rules.edit",
	"quotes.view",
	"quotes.view_prices",
	"quotes.create",
	"quotes.send_any",
	"costs.view_materials",
	"costs.view_full",
	"invoices.view",
	"invoices.send",
	"invoices.edit",
	"work_orders.view",
	"work_orders.edit_status",
	"purchase_orders.view",
	"purchase_orders.edit",
	"audit_log.view",
	"settings.company",
] as const;

export type AppPermission = (typeof APP_PERMISSIONS)[number];

const ALL_PERMISSIONS: readonly AppPermission[] = APP_PERMISSIONS;

export const ROLE_PERMISSIONS: Record<AppRole, readonly AppPermission[]> = {
	md: ALL_PERMISSIONS,
	gm: ALL_PERMISSIONS,
	accounting: [
		"materials.view",
		"materials.view_prices",
		"templates.view",
		"pricing_rules.edit",
		"quotes.view",
		"quotes.view_prices",
		"quotes.send_any",
		"costs.view_materials",
		"costs.view_full",
		"invoices.view",
		"invoices.send",
		"invoices.edit",
		"work_orders.view",
		"purchase_orders.view",
		"audit_log.view",
	],
	procurement: [
		"materials.view",
		"materials.view_prices",
		"materials.edit",
		"templates.view",
		"templates.edit",
		"quotes.view",
		"quotes.view_prices",
		"costs.view_materials",
		"work_orders.view",
		"purchase_orders.view",
		"purchase_orders.edit",
	],
	production: [
		"materials.view",
		"templates.view",
		"templates.edit",
		"templates.delete",
		"quotes.view",
		"work_orders.view",
		"work_orders.edit_status",
		"purchase_orders.view",
	],
	sales: [
		"templates.view",
		"quotes.view",
		"quotes.view_prices",
		"quotes.create",
		"invoices.view",
		"invoices.send",
		"work_orders.view",
	],
	customer_care: [
		"templates.view",
		"quotes.view",
		"quotes.view_prices",
		"quotes.create",
		"invoices.view",
		"invoices.send",
		"work_orders.view",
	],
};

const ROLE_SET = new Set<string>(APP_ROLES);

export function isAppRole(value: unknown): value is AppRole {
	return typeof value === "string" && ROLE_SET.has(value);
}

export function isOwnerAppRole(role: AppRole): boolean {
	return role === "md" || role === "gm";
}

export function hasPermission(role: AppRole, permission: AppPermission): boolean {
	return ROLE_PERMISSIONS[role].includes(permission);
}

/** Route prefixes restricted to specific roles. Longest/most-specific prefixes first. */
const ROUTE_ROLE_RULES: Array<{ prefix: string; roles: readonly AppRole[] }> = [
	// Company settings: MD and GM change them; Accounting can view them (read-only in the UI)
	{ prefix: "/settings/company", roles: ["md", "gm", "accounting"] },
	{ prefix: "/settings/documents", roles: ["md", "gm", "accounting"] },
	{ prefix: "/settings/numbering", roles: ["md", "gm", "accounting"] },
	{ prefix: "/settings/tax", roles: ["md", "gm", "accounting"] },
	{ prefix: "/settings/trade", roles: ["md", "gm", "accounting"] },
	{ prefix: "/settings/agent", roles: ["md", "gm", "accounting"] },
	{ prefix: "/settings/sending", roles: ["md", "gm", "accounting"] },
	{ prefix: "/team", roles: ["md", "gm"] },
	{ prefix: "/pricing", roles: ["md", "gm", "accounting"] },
	{ prefix: "/cost-rates", roles: ["md", "gm", "accounting"] },
	{ prefix: "/staff", roles: ["md", "gm", "accounting"] },
	{ prefix: "/finance", roles: ["md", "gm", "accounting"] },
	{ prefix: "/invoices", roles: ["md", "gm", "accounting"] },
	{ prefix: "/quotes", roles: ["md", "gm", "accounting", "sales", "customer_care"] },
	{ prefix: "/clients", roles: ["md", "gm", "accounting", "sales", "customer_care"] },
	{ prefix: "/work-orders", roles: ["md", "gm", "procurement", "production"] },
	{
		prefix: "/furniture-types",
		roles: ["md", "gm", "procurement", "production", "sales", "customer_care"],
	},
	{ prefix: "/machines", roles: ["md", "gm", "procurement", "production"] },
	{ prefix: "/inventory", roles: ["md", "gm", "accounting", "procurement", "production"] },
	{ prefix: "/cost-requests", roles: ["md", "gm", "procurement"] },
	{ prefix: "/suppliers", roles: ["md", "gm", "procurement"] },
	{ prefix: "/purchase-orders", roles: ["md", "gm", "accounting", "procurement"] },
];

export function canAccessRoute(role: AppRole, pathname: string): boolean {
	const rule = ROUTE_ROLE_RULES.find(
		({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`),
	);
	if (!rule) return true;
	return rule.roles.includes(role);
}
