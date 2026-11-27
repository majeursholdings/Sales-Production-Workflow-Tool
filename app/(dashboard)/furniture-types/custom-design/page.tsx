import type { Metadata } from "next";
import CustomDesignFlow from "@/components/furniture/customDesign/customDesignFlow";
import PageTitle from "@/components/layout/pageTitle";
import PageWrapper from "@/components/layout/pageWrapper";
import { getAgentStatus } from "@/lib/data/aiSettings";
import { getCompanyConfig } from "@/lib/data/companySettings";
import { getPublishedTypeNames } from "@/lib/data/furnitureTypes";
import { hasPermission } from "@/lib/roles";
import { requireRouteAccess } from "@/lib/session";

export const metadata: Metadata = { title: "Custom design from photo" };

/** The parts agent reads photos with an AI model, which can take a minute or two. */
export const maxDuration = 180;

export default async function CustomDesignPage({
	searchParams,
}: {
	/** `for`: furniture type id, to start on "an addition to" that piece. */
	searchParams: Promise<{ for?: string }>;
}) {
	const user = await requireRouteAccess("/furniture-types");
	const [{ for: forId }, settings, targets, agent] = await Promise.all([
		searchParams,
		getCompanyConfig(),
		getPublishedTypeNames(),
		getAgentStatus(),
	]);
	const initialTarget = targets.some((t) => t.id === forId) ? (forId ?? null) : null;

	return (
		<PageWrapper>
			<PageTitle
				breadcrumbs={[
					{ label: "Furniture types", href: "/furniture-types" },
					{ label: "Custom design from photo" },
				]}
				pageTitle="Custom design from photo"
				pageDescription="Start a one-off piece from a client's photo or sketch. The parts agent picks parts from inventory and flags anything we don't stock."
			/>
			<CustomDesignFlow
				rules={settings.agent}
				targets={targets}
				initialTarget={initialTarget}
				agentReady={agent.ready}
				canBuild={hasPermission(user.roleKey, "quotes.create")}
			/>
		</PageWrapper>
	);
}
