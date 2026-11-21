import SecurityPanel from "@/components/settings/securityPanel";
import { getCurrentUser } from "@/lib/session";
import { createClient } from "@/utils/supabase/server";

export default async function SettingsSecurityPage() {
	const user = await getCurrentUser();
	const supabase = await createClient();
	const { data } = await supabase.auth.mfa.listFactors();

	const factors = (data?.totp ?? [])
		.filter((factor) => factor.status === "verified")
		.map((factor) => ({
			id: factor.id,
			friendlyName: factor.friendly_name || "Authenticator app",
			createdAt: factor.created_at,
		}));

	return <SecurityPanel email={user.email} factors={factors} />;
}
