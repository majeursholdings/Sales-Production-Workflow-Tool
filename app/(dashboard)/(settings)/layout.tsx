import type { ReactNode } from "react";
import { isOwnerRole } from "@/components/layout/navigation";
import { SETTINGS_GROUPS } from "@/components/settings/settingsSections";
import SettingsNav from "@/components/settings/settingsNav";
import { getCurrentUser } from "@/lib/session";

/** Settings shell: page head, section list on the left, the active section on the right. */
export default async function SettingsLayout({ children }: { children: ReactNode }) {
	const user = await getCurrentUser();
	const owner = isOwnerRole(user.role);
	const groups = SETTINGS_GROUPS.filter((g) => !g.ownerOnly || owner);

	return (
		<div className="flex flex-col gap-6">
			<div>
				<h1>Settings</h1>
				<p className="text-small text-fg-tertiary">
					{owner
						? "Your account and how the company runs."
						: "Your profile, notifications and sign-in."}
				</p>
			</div>
			<div className="flex flex-col gap-6 md:flex-row md:items-start">
				<SettingsNav groups={groups} />
				<div className="flex min-w-0 flex-1 flex-col gap-6">{children}</div>
			</div>
		</div>
	);
}
