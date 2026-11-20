import type { ReactNode } from "react";
import MobileNav from "@/components/layout/mobileNav";
import Sidebar from "@/components/layout/sidebar";
import { getCurrentUser } from "@/lib/session";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
	const user = await getCurrentUser();
	const nav = {
		userName: user.name,
		userRole: user.role,
		unreadNotificationsCount: user.unreadNotificationsCount,
	};

	return (
		<div className="flex min-h-screen max-[860px]:flex-col">
			<Sidebar {...nav} />
			<MobileNav {...nav} />
			{/* Bottom padding clears the fixed mobile tab bar. */}
			<div className="min-w-0 flex-1 px-4 py-6 max-[860px]:pb-24 md:px-8">{children}</div>
		</div>
	);
}
