import {
	Armchair,
	Calculator,
	Cog,
	FileText,
	LayoutDashboard,
	MessageSquare,
	Package,
	Receipt,
	ShieldCheck,
	ShoppingBag,
	Tag,
	TrendingUp,
	Truck,
	UserPlus,
	Users,
	Wrench,
	type LucideIcon,
} from "lucide-react";

export type NavKey =
	| "dashboard"
	| "quotes"
	| "clients"
	| "finance"
	| "invoices"
	| "workOrders"
	| "types"
	| "machines"
	| "inventory"
	| "requests"
	| "suppliers"
	| "purchaseOrders"
	| "pricing"
	| "costs"
	| "staff"
	| "team";

export type NavItem = {
	label: string;
	/** Short label for the mobile tab bar. */
	shortLabel: string;
	href: string;
	icon: LucideIcon;
};

// TODO: confirm these hrefs against the real route structure as pages are added.
export const NAV_ITEMS: Record<NavKey, NavItem> = {
	dashboard: { label: "Dashboard", shortLabel: "Home", href: "/", icon: LayoutDashboard },
	quotes: { label: "Quotes", shortLabel: "Quotes", href: "/quotes", icon: FileText },
	clients: { label: "Clients", shortLabel: "Clients", href: "/clients", icon: Users },
	finance: {
		label: "Revenue & expenses",
		shortLabel: "Finance",
		href: "/finance",
		icon: TrendingUp,
	},
	invoices: { label: "Invoices", shortLabel: "Invoices", href: "/invoices", icon: Receipt },
	workOrders: { label: "Job cards", shortLabel: "Job cards", href: "/work-orders", icon: Wrench },
	types: {
		label: "Furniture types",
		shortLabel: "Furniture",
		href: "/furniture-types",
		icon: Armchair,
	},
	machines: { label: "Machines", shortLabel: "Machines", href: "/machines", icon: Cog },
	inventory: {
		label: "Inventory & parts",
		shortLabel: "Stock",
		href: "/inventory",
		icon: Package,
	},
	requests: {
		label: "Cost requests",
		shortLabel: "Requests",
		href: "/cost-requests",
		icon: MessageSquare,
	},
	suppliers: { label: "Suppliers", shortLabel: "Suppliers", href: "/suppliers", icon: Truck },
	purchaseOrders: {
		label: "Purchase orders",
		shortLabel: "POs",
		href: "/purchase-orders",
		icon: ShoppingBag,
	},
	pricing: { label: "Pricing & margins", shortLabel: "Pricing", href: "/pricing", icon: Tag },
	costs: { label: "Cost rates", shortLabel: "Costs", href: "/cost-rates", icon: Calculator },
	staff: { label: "Staff", shortLabel: "Staff", href: "/staff", icon: UserPlus },
	team: { label: "Team & access", shortLabel: "Team", href: "/team", icon: ShieldCheck },
};

export type NavGroup = { label: string; keys: NavKey[] };

/** Group label "" = unlabelled overview group. */
export const NAV_GROUPS: NavGroup[] = [
	{ label: "", keys: ["dashboard"] },
	{ label: "Sales", keys: ["quotes", "clients"] },
	{ label: "Finance", keys: ["finance", "invoices"] },
	{ label: "Production", keys: ["workOrders", "types", "machines"] },
	{ label: "Stock & purchasing", keys: ["inventory", "requests", "suppliers", "purchaseOrders"] },
	{ label: "Admin", keys: ["pricing", "costs", "staff", "team"] },
];

const ALL_KEYS = Object.keys(NAV_ITEMS) as NavKey[];

// First matching role wins. Roles are matched against the user's role label.
const ROLE_ACCESS: Array<{ match: RegExp; allowed: NavKey[]; tabs: NavKey[] }> = [
	{
		match: /director|general manager|md|gm/i,
		allowed: ALL_KEYS,
		tabs: ["dashboard", "quotes", "finance", "workOrders"],
	},
	{
		match: /accounting/i,
		allowed: [
			"dashboard",
			"quotes",
			"clients",
			"finance",
			"invoices",
			"inventory",
			"purchaseOrders",
			"pricing",
			"costs",
			"staff",
		],
		tabs: ["dashboard", "quotes", "finance", "invoices"],
	},
	{
		match: /procurement/i,
		allowed: [
			"dashboard",
			"workOrders",
			"types",
			"machines",
			"inventory",
			"requests",
			"suppliers",
			"purchaseOrders",
		],
		tabs: ["dashboard", "requests", "inventory", "purchaseOrders"],
	},
	{
		match: /production/i,
		allowed: ["dashboard", "workOrders", "types", "machines", "inventory"],
		tabs: ["dashboard", "workOrders", "types", "inventory"],
	},
	{
		match: /.*/,
		allowed: ["dashboard", "quotes", "clients", "types"],
		tabs: ["dashboard", "quotes", "clients", "types"],
	},
];

export function getNavForRole(role: string) {
	const access = ROLE_ACCESS.find((a) => a.match.test(role))!;
	const groups = NAV_GROUPS.map((g) => ({
		label: g.label,
		keys: g.keys.filter((k) => access.allowed.includes(k)),
	})).filter((g) => g.keys.length > 0);
	const tabs = access.tabs.filter((k) => access.allowed.includes(k));
	return { groups, tabs };
}

export function isActive(pathname: string, href: string) {
	return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
