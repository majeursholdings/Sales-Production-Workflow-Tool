import Link from "next/link";
import { Badge, type BadgeVariant } from "@/components/common/badge";

export type Breadcrumb = {
	label: string;
	/** Leave off for the current page (the last crumb). */
	href?: string;
};

type PageTitleProps = {
	pageTitle: string;
	pageDescription: string;
	/** Trail above the title, e.g. [{ label: "Settings", href: "/settings" }, { label: "Security" }]. */
	breadcrumbs?: Breadcrumb[];
	/** Status pill beside the title, e.g. { label: "Draft", variant: "warning" }. */
	badge?: { label: string; variant?: BadgeVariant };
};

export default function PageTitle({
	pageTitle,
	pageDescription,
	breadcrumbs,
	badge,
}: PageTitleProps) {
	return (
		<div className="space-y-1">
			{breadcrumbs && breadcrumbs.length > 0 && (
				<nav aria-label="Breadcrumb">
					<ol className="flex flex-wrap items-center gap-x-2 text-small text-fg-tertiary">
						{breadcrumbs.map((crumb, i) => {
							const current = i === breadcrumbs.length - 1;
							return (
								<li key={`${crumb.label}-${i}`} className="flex items-center gap-2">
									{crumb.href && !current ? (
										<Link href={crumb.href}>{crumb.label}</Link>
									) : (
										<span aria-current={current ? "page" : undefined}>
											{crumb.label}
										</span>
									)}
									{!current && <span aria-hidden="true">/</span>}
								</li>
							);
						})}
					</ol>
				</nav>
			)}
			<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
				<h1 className="text-inverse">{pageTitle}</h1>
				{badge && <Badge variant={badge.variant}>{badge.label}</Badge>}
			</div>
			<p className="text-small text-fg-tertiary">{pageDescription}</p>
		</div>
	);
}
