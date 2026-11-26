// ─────────────────────────────────────────────────────────────────────────────
// Shared Supabase Storage constants & URL/path validation for private project
// media. App code always uploads and reads via server-side Supabase Storage
// (never directly from the browser).
// ─────────────────────────────────────────────────────────────────────────────

export const PROJECT_MEDIA_BUCKET = "project-media";
export const STORAGE_API_PREFIX = "/api/storage/";
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10 MB per file
export const MAX_PHOTOS_PER_UPLOAD = 6;

export const STORAGE_FOLDERS = [
	"furniture",
	"parts",
	"machines",
	"job-cards",
	"cost-requests",
] as const;

export type StorageFolder = (typeof STORAGE_FOLDERS)[number];

const FOLDER_SET = new Set<string>(STORAGE_FOLDERS);

export function isStorageFolder(value: unknown): value is StorageFolder {
	return typeof value === "string" && FOLDER_SET.has(value);
}

/** Allowed image MIME types → canonical file extension. */
export const PHOTO_MIME_TO_EXT: Record<string, string> = {
	"image/jpeg": "jpg",
	"image/png": "png",
	"image/webp": "webp",
	"image/gif": "gif",
	"image/avif": "avif",
	"image/heic": "heic",
	"image/heif": "heif",
};

const EXT_TO_MIME: Record<string, string> = {
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	png: "image/png",
	webp: "image/webp",
	gif: "image/gif",
	avif: "image/avif",
	heic: "image/heic",
	heif: "image/heif",
};

/**
 * Resolves a validated MIME type and extension for an uploaded image.
 * Browsers often leave `file.type` blank for HEIC/HEIF photos, so falls back
 * to the filename extension only when it maps to an allowed image type.
 */
export function resolvePhotoType(file: Pick<File, "type" | "name">): {
	mime: string;
	ext: string;
} | null {
	const rawMime = file.type.trim().toLowerCase();
	if (rawMime && rawMime in PHOTO_MIME_TO_EXT) {
		return { mime: rawMime, ext: PHOTO_MIME_TO_EXT[rawMime] };
	}
	const ext = file.name.split(".").pop()?.trim().toLowerCase() ?? "";
	const fallbackMime = EXT_TO_MIME[ext];
	if (fallbackMime) {
		return { mime: fallbackMime, ext: PHOTO_MIME_TO_EXT[fallbackMime] };
	}
	return null;
}

const SAFE_FILENAME = /^[a-zA-Z0-9._-]{1,160}$/;

/** Builds the app-authenticated URL stored in Postgres for a private bucket object. */
export function storageUrlFor(objectPath: string): string {
	return `${STORAGE_API_PREFIX}${objectPath}`;
}

/**
 * Extracts and validates `<folder>/<filename>` from an app storage URL.
 * Rejects path traversal, unexpected folders, or nested segments.
 */
export function objectPathFromUrl(url: string): string | null {
	if (!url.startsWith(STORAGE_API_PREFIX)) return null;
	const rest = url.slice(STORAGE_API_PREFIX.length);
	const parts = rest.split("/");
	if (parts.length !== 2) return null;
	const [folder, filename] = parts;
	if (!isStorageFolder(folder)) return null;
	if (!SAFE_FILENAME.test(filename) || filename.includes("..")) return null;
	return `${folder}/${filename}`;
}

/**
 * Validates that a photo URL saved to Postgres belongs to our authenticated
 * storage proxy (and optionally a specific folder).
 */
export function isValidStorageUrl(url: string, folder?: StorageFolder): boolean {
	const path = objectPathFromUrl(url);
	if (!path) return false;
	return folder ? path.startsWith(`${folder}/`) : true;
}

/** Builds a clean storage path inside `folder` with a unique filename. */
export function buildStoragePath(folder: StorageFolder, ext: string): string {
	return `${folder}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
}
