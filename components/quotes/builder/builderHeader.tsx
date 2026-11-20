import Link from "next/link";
import type { ReactNode } from "react";
import { Check } from "lucide-react";
import PageTitle from "@/components/layout/pageTitle";
import { cn } from "@/lib/cn";
import { DRAFT_NUMBER, DRAFT_VALID_UNTIL } from "@/lib/quoteBuilder";

const STEPS = [
	{ label: "Client", href: "/quotes/new" },
	{ label: "Items & parts", href: "/quotes/new/items" },
	{ label: "Review & send", href: "/quotes/new/review" },
];

/** Title, buttons and the three-step progress bar shared by every step of the quote builder. */
export default function BuilderHeader({
	step,
	createdBy,
	actions,
	sent = false,
}: {
	/** 1, 2 or 3. */
	step: 1 | 2 | 3;
	createdBy: string;
	actions?: ReactNode;
	sent?: boolean;
}) {
	return (
		<>
			<PageTitle
				breadcrumbs={[{ label: "Quotes", href: "/quotes" }, { label: "New quote" }]}
				pageTitle="New quote"
				badge={sent ? { label: "Sent", variant: "info" } : { label: "Draft" }}
				pageDescription={`${DRAFT_NUMBER} · Created by ${createdBy} · Valid until ${DRAFT_VALID_UNTIL}`}
				actions={actions}
			/>
			<ol
				aria-label="Quote steps"
				className="flex flex-wrap items-center gap-x-3 gap-y-2 text-body"
			>
				{STEPS.map((s, i) => {
					const n = i + 1;
					const state = n < step ? "done" : n === step ? "current" : "next";
					const marker = (
						<span
							aria-hidden="true"
							className={cn(
								"grid size-6 place-items-center rounded-full text-small font-bold",
								state === "current" && "bg-accent text-on-accent",
								state === "done" && "bg-success-subtle text-success-fg",
								state === "next" && "bg-subtle text-fg-secondary",
							)}
						>
							{state === "done" ? <Check className="size-3.5" /> : n}
						</span>
					);
					return (
						<li key={s.label} className="contents">
							{i > 0 && (
								<span aria-hidden="true" className="h-px w-8 bg-line-strong" />
							)}
							{state === "done" ? (
								<Link
									href={s.href}
									className="flex items-center gap-2 text-fg no-underline hover:underline"
								>
									{marker}
									{s.label}
								</Link>
							) : (
								<span
									aria-current={state === "current" ? "step" : undefined}
									className={cn(
										"flex items-center gap-2",
										state === "current"
											? "font-bold text-fg"
											: "text-fg-secondary",
									)}
								>
									{marker}
									{s.label}
								</span>
							)}
						</li>
					);
				})}
			</ol>
		</>
	);
}
