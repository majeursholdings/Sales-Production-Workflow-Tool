import { NextResponse, type NextRequest } from "next/server";
import { inviteOwner } from "@/lib/invites";
import { afterLinkSignIn } from "@/lib/linkSignIn";
import { isAccountLocked } from "@/lib/loginLock";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";

/**
 * The link in an invite email: checks our 48-hour token, verifies the account is
 * still active and unlocked, then signs the person in (a one-time Supabase link
 * minted and used right here, never emailed) and sends them to /welcome to set
 * their password.
 */
export async function GET(request: NextRequest) {
	const { origin, searchParams } = request.nextUrl;
	const token = searchParams.get("token") ?? "";
	const fail = NextResponse.redirect(`${origin}/login?error=invite_expired`);

	const invite = token ? await inviteOwner(token) : null;
	if (!invite) return fail;

	const admin = createAdminClient();
	const [{ data: userData }, { data: profile }] = await Promise.all([
		admin.auth.admin.getUserById(invite.userId),
		admin.from("profiles").select("is_active").eq("id", invite.userId).maybeSingle(),
	]);
	const email = userData.user?.email;
	if (!email) return fail;
	if (!profile || !profile.is_active) {
		return NextResponse.redirect(`${origin}/login?error=deactivated`);
	}
	if (await isAccountLocked(email)) {
		return NextResponse.redirect(`${origin}/login?error=locked`);
	}

	const { data: link, error: linkError } = await admin.auth.admin.generateLink({
		type: "magiclink",
		email,
	});
	if (linkError || !link.properties?.hashed_token) return fail;

	const supabase = await createClient();
	const { error } = await supabase.auth.verifyOtp({
		type: "magiclink",
		token_hash: link.properties.hashed_token,
	});
	if (error) return fail;

	await afterLinkSignIn(supabase, true);
	return NextResponse.redirect(`${origin}/welcome`);
}
