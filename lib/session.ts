export type SessionUser = {
	name: string;
	/** Drives which nav items are visible (see components/layout/navigation.ts). */
	role: string;
	unreadNotificationsCount: number;
};

/**
 * TODO: replace with the real signed-in user once auth exists.
 * This is a placeholder so the dashboard shell can render; every caller goes
 * through here, so swapping in real auth is a one-file change.
 */
export async function getCurrentUser(): Promise<SessionUser> {
	return { name: "Staff Name", role: "Director", unreadNotificationsCount: 0 };
}
