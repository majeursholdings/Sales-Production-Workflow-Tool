import SecurityPanel from "@/components/settings/securityPanel";
import { getCurrentUser } from "@/lib/session";
import { createClient } from "@/utils/supabase/server";

export default async function SettingsSecurityPage() {
	const user = await getCurrentUser();
	const supabase = await createClient();
	const [{ data }, { data: profile }] = await Promise.all([
		supabase.auth.mfa.listFactors(),
		supabase.from("profiles").select("two_step_email").eq("id", user.id).maybeSingle(),
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
		/>
	);
}
