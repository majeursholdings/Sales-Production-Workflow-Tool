import { Suspense, type ReactNode } from "react";
import PageTitle from "@/components/layout/pageTitle";
import { isOwnerRole } from "@/components/layout/navigation";
import { SETTINGS_GROUPS } from "@/components/settings/settingsSections";
import SettingsNav from "@/components/settings/settingsNav";
import { getCurrentUser } from "@/lib/session";
import PageWrapper from "@/components/layout/pageWrapper";

async function SettingsShell({ children }: { children: ReactNode }) {
	const user = await getCurrentUser();
	const owner = isOwnerRole(user.role);
	const groups = SETTINGS_GROUPS.filter((g) => !g.ownerOnly || owner);

	return (
		<>
			<PageTitle
				pageTitle="Settings"
				pageDescription={
					owner
						? "Your account and how the company runs."
						: "Your profile, notifications and sign-in."
				}
			/>
			<div className="flex flex-col gap-6 md:flex-row md:items-start">
				<SettingsNav groups={groups} />
				<div className="flex min-w-0 flex-1 flex-col gap-6">{children}</div>
			</div>
		</>
	);
}

/** Settings shell: page head, section list on the left, the active section on the right. */
export default function SettingsLayout({ children }: { children: ReactNode }) {
	return (
		<PageWrapper>
			<Suspense fallback={null}>
				<SettingsShell>{children}</SettingsShell>
			</Suspense>
		</PageWrapper>
	);
}
