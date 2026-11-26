"use client";

import type { StorageFolder } from "@/lib/storage";

/**
 * Uploads one or more photos through the app's authenticated storage endpoint
 * (`/api/storage/upload`) into the private `project-media` Supabase bucket.
 * Returns the `/api/storage/<folder>/<file>` URLs to persist in Postgres.
 */
export async function uploadStorageFiles(
	folder: StorageFolder,
	files: File[],
): Promise<{ ok: true; urls: string[] } | { ok: false; message: string }> {
	if (files.length === 0) return { ok: true, urls: [] };

	const body = new FormData();
	body.append("folder", folder);
	for (const file of files) {
		body.append("files", file);
	}

	let res: Response;
	try {
		res = await fetch("/api/storage/upload", {
			method: "POST",
			body,
		});
	} catch {
		return { ok: false, message: "Couldn't reach the server to upload photos. Try again." };
	}

	const payload = (await res.json().catch(() => null)) as {
		urls?: string[];
		error?: string;
	} | null;

	if (!res.ok || !Array.isArray(payload?.urls)) {
		return {
			ok: false,
			message: payload?.error ?? "Couldn't upload the selected photos. Try again.",
		};
	}

	return { ok: true, urls: payload.urls };
}

type SavedLike = { url: string };

function isSavedLike(value: unknown): value is SavedLike {
	return (
		!!value &&
		typeof value === "object" &&
		"url" in value &&
		typeof (value as SavedLike).url === "string"
	);
}

/**
 * Resolves a `FileInput` field value (mixed existing `SavedFile`s and newly
 * picked `File`s) into final `/api/storage/...` URLs, uploading only new files.
 */
export async function resolveUploadedPhotos(
	folder: StorageFolder,
	value: unknown,
): Promise<{ ok: true; urls: string[] } | { ok: false; message: string }> {
	const items = Array.isArray(value) ? value : value ? [value] : [];
	const newFiles = items.filter((item): item is File => item instanceof File);
	let uploaded: string[] = [];
	if (newFiles.length > 0) {
		const res = await uploadStorageFiles(folder, newFiles);
		if (!res.ok) return res;
		uploaded = res.urls;
	}

	let idx = 0;
	const urls: string[] = [];
	for (const item of items) {
		if (item instanceof File) {
			if (uploaded[idx]) urls.push(uploaded[idx]);
			idx++;
		} else if (isSavedLike(item) && item.url) {
			urls.push(item.url);
		}
	}
	return { ok: true, urls };
}
