import type { Metadata } from "next";
import { LinkButton } from "@/components/common/buttons";
import { Card } from "@/components/common/card";
import PageTitle from "@/components/layout/pageTitle";
import PageWrapper from "@/components/layout/pageWrapper";
import { requireRouteAccess } from "@/lib/session";

export const metadata: Metadata = { title: "Custom design from photo" };

/** TODO: build the custom design flow (upload a photo, get a draft template and price). */
export default async function CustomDesignPage() {
	await requireRouteAccess("/furniture-types");
	return (
		<PageWrapper>
			<PageTitle
				breadcrumbs={[
					{ label: "Furniture types", href: "/furniture-types" },
					{ label: "Custom design from photo" },
				]}
				pageTitle="Custom design from photo"
				pageDescription="Start a one-off piece from a client's photo or sketch."
			/>
			<Card className="items-start gap-3">
				<h2>Coming soon</h2>
				<p className="text-body text-fg-secondary">
					This flow isn&apos;t built yet. For now, make a new furniture type or quote an
					existing one.
				</p>
				<LinkButton href="/furniture-types">Back to furniture types</LinkButton>
			</Card>
		</PageWrapper>
	);
}
