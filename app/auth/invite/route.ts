import { NextResponse, type NextRequest } from "next/server";
import { inviteOwner } from "@/lib/invites";
import { afterLinkSignIn } from "@/lib/linkSignIn";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";

/**
 * The link in an invite email: checks our 48-hour token, then signs the person
 * in (a one-time Supabase link minted and used right here, never emailed) and
 * sends them to /welcome to set their password. The token stays valid until
 * they've set one, so opening the link twice is fine.
 */
export async function GET(request: NextRequest) {
	const { origin, searchParams } = request.nextUrl;
	const token = searchParams.get("token") ?? "";
	const fail = NextResponse.redirect(`${origin}/login?error=invite_expired`);

	const invite = token ? await inviteOwner(token) : null;
	if (!invite) return fail;

	const admin = createAdminClient();
	const { data: userData } = await admin.auth.admin.getUserById(invite.userId);
	const email = userData.user?.email;
	if (!email) return fail;

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
