import SecurityPanel from "@/components/settings/securityPanel";
import { currentSession } from "@/lib/currentSession";
import { getCurrentUser } from "@/lib/session";
import { createClient } from "@/utils/supabase/server";

export default async function SettingsSecurityPage() {
	const user = await getCurrentUser();
	const supabase = await createClient();
	const [{ data }, { data: profile }, session] = await Promise.all([
		supabase.auth.mfa.listFactors(),
		supabase.from("profiles").select("two_step_email").eq("id", user.id).maybeSingle(),
		currentSession(),
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
		/>
	);
}
