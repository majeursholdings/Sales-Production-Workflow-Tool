import {
	PROJECT_MEDIA_BUCKET,
	objectPathFromUrl,
	type StorageFolder,
} from "@/lib/storage";
import { hasPermission, isAppRole, type AppRole } from "@/lib/roles";
import type { createClient } from "@/utils/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Mirrors the `storage.objects` INSERT/DELETE RLS rules for fast server-side checks. */
export function canUploadToFolder(role: AppRole, folder: StorageFolder): boolean {
	switch (folder) {
		case "furniture":
			return hasPermission(role, "templates.edit");
		case "parts":
			return hasPermission(role, "materials.edit");
		case "machines":
			return (
				hasPermission(role, "work_orders.edit_status") ||
				hasPermission(role, "materials.edit")
			);
		case "job-cards":
			return hasPermission(role, "work_orders.edit_status");
		case "cost-requests":
			return hasPermission(role, "quotes.create") || hasPermission(role, "materials.edit");
	}
}

/** Mirrors the `storage.objects` SELECT RLS rules. */
export function canReadFromFolder(role: AppRole, folder: StorageFolder): boolean {
	if (!isAppRole(role)) return false;
	switch (folder) {
		case "furniture":
			return true;
		case "parts":
			return (
				hasPermission(role, "materials.view") ||
				hasPermission(role, "templates.view") ||
				hasPermission(role, "work_orders.view") ||
				hasPermission(role, "purchase_orders.view")
			);
		case "machines":
			return (
				hasPermission(role, "work_orders.view") || hasPermission(role, "materials.view")
			);
		case "job-cards":
			return hasPermission(role, "work_orders.view");
		case "cost-requests":
			return (
				hasPermission(role, "materials.view") ||
				hasPermission(role, "quotes.create") ||
				hasPermission(role, "quotes.view")
			);
	}
}

/**
 * Best-effort cleanup of removed `/api/storage/...` files from the private
 * `project-media` bucket. Non-storage URLs and already-deleted files are ignored.
 */
export async function removeStorageUrls(
	supabase: Supabase,
	urls: readonly (string | null | undefined)[],
	expectedFolder?: StorageFolder,
): Promise<void> {
	const paths = [
		...new Set(
			urls
				.filter((u): u is string => typeof u === "string" && u.length > 0)
				.map((u) => objectPathFromUrl(u))
				.filter(
					(p): p is string =>
						p !== null && (!expectedFolder || p.startsWith(`${expectedFolder}/`)),
				),
		),
	];
	if (paths.length === 0) return;
	await supabase.storage.from(PROJECT_MEDIA_BUCKET).remove(paths);
}
