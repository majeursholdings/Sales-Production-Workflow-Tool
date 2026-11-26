import { NextResponse, type NextRequest } from "next/server";
import { isAppRole } from "@/lib/roles";
import { TRUSTED_DEVICE_COOKIE, sessionExpiresAt } from "@/lib/sessionPolicy";
import {
	MAX_PHOTOS_PER_UPLOAD,
	MAX_PHOTO_BYTES,
	PROJECT_MEDIA_BUCKET,
	buildStoragePath,
	isStorageFolder,
	resolvePhotoType,
	storageUrlFor,
} from "@/lib/storage";
import { canUploadToFolder } from "@/lib/storageServer";
import { sessionState } from "@/lib/twoStep";
import { createClient } from "@/utils/supabase/server";

export async function POST(request: NextRequest) {
	const supabase = await createClient();
	const { data } = await supabase.auth.getClaims();
	const claims = data?.claims;
	if (!claims) {
		return NextResponse.json({ error: "Please sign in to upload files." }, { status: 401 });
	}

	const expiresAt = sessionExpiresAt(claims);
	if (expiresAt !== null && Date.now() / 1000 >= expiresAt) {
		return NextResponse.json({ error: "Your session has expired." }, { status: 401 });
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
		return NextResponse.json({ error: "Your session is not active." }, { status: 401 });
	}

	if (!isAppRole(claims.user_role)) {
		return NextResponse.json({ error: "No role assigned to this account." }, { status: 403 });
	}

	let formData: FormData;
	try {
		formData = await request.formData();
	} catch {
		return NextResponse.json({ error: "Invalid upload payload." }, { status: 400 });
	}

	const folder = formData.get("folder");
	if (!isStorageFolder(folder)) {
		return NextResponse.json({ error: "Invalid storage folder." }, { status: 400 });
	}

	if (!canUploadToFolder(claims.user_role, folder)) {
		return NextResponse.json(
			{ error: "You don't have permission to upload files here." },
			{ status: 403 },
		);
	}

	const rawFiles = formData
		.getAll("files")
		.filter((entry): entry is File => entry instanceof File && entry.size > 0);
	if (rawFiles.length === 0) {
		return NextResponse.json({ error: "Pick at least one image to upload." }, { status: 400 });
	}
	if (rawFiles.length > MAX_PHOTOS_PER_UPLOAD) {
		return NextResponse.json(
			{ error: `You can upload at most ${MAX_PHOTOS_PER_UPLOAD} photos at a time.` },
			{ status: 400 },
		);
	}

	const prepared: { file: File; mime: string; ext: string }[] = [];
	for (const file of rawFiles) {
		if (file.size > MAX_PHOTO_BYTES) {
			return NextResponse.json(
				{ error: `${file.name} is larger than 10 MB.` },
				{ status: 400 },
			);
		}
		const resolved = resolvePhotoType(file);
		if (!resolved) {
			return NextResponse.json(
				{
					error: `${file.name} isn't a supported image (use JPG, PNG, WebP, GIF, AVIF or HEIC).`,
				},
				{ status: 400 },
			);
		}
		prepared.push({ file, ...resolved });
	}

	const uploadedPaths: string[] = [];
	for (const { file, mime, ext } of prepared) {
		const objectPath = buildStoragePath(folder, ext);
		const { error } = await supabase.storage
			.from(PROJECT_MEDIA_BUCKET)
			.upload(objectPath, file, { contentType: mime, upsert: false });
		if (error) {
			if (uploadedPaths.length > 0) {
				await supabase.storage.from(PROJECT_MEDIA_BUCKET).remove(uploadedPaths);
			}
			return NextResponse.json(
				{ error: `Couldn't upload ${file.name}: ${error.message}` },
				{ status: 500 },
			);
		}
		uploadedPaths.push(objectPath);
	}

	return NextResponse.json({
		urls: uploadedPaths.map(storageUrlFor),
	});
}
