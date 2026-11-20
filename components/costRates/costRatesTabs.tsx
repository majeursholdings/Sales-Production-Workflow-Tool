import Link from "next/link";
import { cn } from "@/lib/cn";

const TABS = [
	{ label: "Workshop overhead", href: "/cost-rates" },
	{ label: "Other costs", href: "/cost-rates/other" },
];

/** The two sections of Cost rates, as links so each has its own address. */
export default function CostRatesTabs({ active }: { active: "overhead" | "other" }) {
	const current = active === "overhead" ? TABS[0].href : TABS[1].href;
	return (
		<nav
			aria-label="Cost rate sections"
			className="inline-flex flex-wrap gap-0.5 self-start rounded-md bg-subtle p-0.5"
		>
			{TABS.map((t) => (
				<Link
					key={t.href}
					href={t.href}
					aria-current={t.href === current ? "page" : undefined}
					className={cn(
						"flex h-8 items-center rounded-sm border border-transparent px-3 text-body whitespace-nowrap text-fg-secondary no-underline hover:text-fg",
						t.href === current && "border-line bg-surface font-bold text-fg",
					)}
				>
					{t.label}
				</Link>
			))}
		</nav>
	);
}
