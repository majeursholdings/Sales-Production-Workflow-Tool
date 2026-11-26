import SecurityPanel from "@/components/settings/securityPanel";
import { currentSession } from "@/lib/currentSession";
import { getSignInPolicy } from "@/lib/data/companySettings";
import { getCurrentUser } from "@/lib/session";
import { createClient } from "@/utils/supabase/server";

export default async function SettingsSecurityPage() {
	const user = await getCurrentUser({ allowLockoutReview: true });
	const supabase = await createClient();
	const [{ data }, { data: profile }, session, signInPolicy] = await Promise.all([
		supabase.auth.mfa.listFactors(),
		supabase.from("profiles").select("two_step_email").eq("id", user.id).maybeSingle(),
		currentSession(),
		getSignInPolicy(),
	]);

	const factors = (data?.totp ?? [])
		.filter((factor) => factor.status === "verified")
		.map((factor) => ({
			id: factor.id,
			friendlyName: factor.friendly_name || "Authenticator app",
			createdAt: factor.created_at,
		}));

	return (
		<SecurityPanel
			email={user.email}
			factors={factors}
			emailOn={Boolean(profile?.two_step_email)}
			lockoutReview={session?.lockoutReview ?? false}
			requireTwoStep={signInPolicy.requireTwoStep}
		/>
	);
}
