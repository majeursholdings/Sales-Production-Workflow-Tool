import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";

const ALLOWED_OTP_TYPES = new Set<EmailOtpType>([
	"signup",
	"invite",
	"magiclink",
	"recovery",
	"email_change",
	"email",
]);

function safeNextPath(next: string | null, fallback: string): string {
	if (!next || !next.startsWith("/") || next.startsWith("//")) {
		return fallback;
	}
	return next;
}

export async function GET(request: NextRequest) {
	const { searchParams, origin } = request.nextUrl;
	const tokenHash = searchParams.get("token_hash");
	const type = searchParams.get("type");
	const code = searchParams.get("code");

	const defaultNext =
		type === "recovery" || type === "invite" ? "/forgot-password?mode=reset" : "/";
	const next = safeNextPath(searchParams.get("next"), defaultNext);

	const supabase = await createClient();

	if (tokenHash && type && ALLOWED_OTP_TYPES.has(type as EmailOtpType)) {
		const { error } = await supabase.auth.verifyOtp({
			type: type as EmailOtpType,
			token_hash: tokenHash,
		});
		if (!error) {
			return NextResponse.redirect(`${origin}${next}`);
		}
	} else if (code) {
		const { error } = await supabase.auth.exchangeCodeForSession(code);
		if (!error) {
			return NextResponse.redirect(`${origin}${next}`);
		}
	}

	return NextResponse.redirect(`${origin}/login?error=invalid_link`);
}
