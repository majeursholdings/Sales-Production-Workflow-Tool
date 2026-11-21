import { Suspense, type ReactNode } from "react";
import MobileNav from "@/components/layout/mobileNav";
import Sidebar from "@/components/layout/sidebar";
import { getCurrentUser } from "@/lib/session";

async function DashboardNavigation() {
	const user = await getCurrentUser();
	const nav = {
		userName: user.name,
		userRole: user.role,
		unreadNotificationsCount: user.unreadNotificationsCount,
	};

	return (
		<>
			<Sidebar {...nav} />
			<MobileNav {...nav} />
		</>
	);
}

function DashboardNavSkeleton() {
	return (
		<aside
			aria-hidden="true"
			className="hidden w-64 shrink-0 border-r border-line bg-surface min-[861px]:block"
		/>
	);
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
	return (
		<div className="flex min-h-screen max-[860px]:flex-col">
			<Suspense fallback={<DashboardNavSkeleton />}>
				<DashboardNavigation />
			</Suspense>
			{/* Bottom padding clears the fixed mobile tab bar. */}
			<div className="min-w-0 flex-1 px-4 py-6 max-[860px]:pb-24 md:px-8">{children}</div>
		</div>
	);
}
