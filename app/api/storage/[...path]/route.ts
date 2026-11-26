import { NextResponse, type NextRequest } from "next/server";
import { isAppRole } from "@/lib/roles";
import { TRUSTED_DEVICE_COOKIE, sessionExpiresAt } from "@/lib/sessionPolicy";
import {
	PROJECT_MEDIA_BUCKET,
	STORAGE_API_PREFIX,
	isStorageFolder,
	objectPathFromUrl,
	resolvePhotoType,
} from "@/lib/storage";
import { canReadFromFolder } from "@/lib/storageServer";
import { sessionState } from "@/lib/twoStep";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
	const { path } = await context.params;
	if (!Array.isArray(path) || path.length !== 2) {
		return new NextResponse("Not found", { status: 404 });
	}

	const [folder, filename] = path;
	const objectPath = objectPathFromUrl(`${STORAGE_API_PREFIX}${folder}/${filename}`);
	if (!objectPath || !isStorageFolder(folder)) {
		return new NextResponse("Not found", { status: 404 });
	}

	const supabase = await createClient();
	const { data } = await supabase.auth.getClaims();
	const claims = data?.claims;
	if (!claims) {
		return new NextResponse("Unauthorized", { status: 401 });
	}

	const expiresAt = sessionExpiresAt(claims);
	if (expiresAt !== null && Date.now() / 1000 >= expiresAt) {
		return new NextResponse("Unauthorized", { status: 401 });
	}

	const state = await sessionState(supabase, {
		aal: typeof claims.aal === "string" ? claims.aal : undefined,
		deviceToken: request.cookies.get(TRUSTED_DEVICE_COOKIE)?.value,
	});
	if (
		state.accountLocked ||
		!state.live ||
		!state.active ||
		claims.user_active === false ||
		state.owed ||
		state.needsPassword ||
		state.lockoutReview
	) {
		return new NextResponse("Unauthorized", { status: 401 });
	}

	const liveRole = state.hasProfileFields ? state.role : claims.user_role;
	if (!isAppRole(liveRole) || !canReadFromFolder(liveRole, folder)) {
		return new NextResponse("Forbidden", { status: 403 });
	}

	const { data: blob, error } = await supabase.storage
		.from(PROJECT_MEDIA_BUCKET)
		.download(objectPath);
	if (error || !blob) {
		return new NextResponse("Not found", { status: 404 });
	}

	const fallbackMime = resolvePhotoType({ name: filename, type: "" })?.mime;
	const contentType = blob.type || fallbackMime || "application/octet-stream";

	return new NextResponse(blob, {
		status: 200,
		headers: {
			"Content-Type": contentType,
			"Content-Disposition": "inline",
			"X-Content-Type-Options": "nosniff",
			"Cache-Control": "private, max-age=3600",
		},
	});
}
