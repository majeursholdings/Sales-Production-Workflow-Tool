import { Suspense } from "react";
import type { Metadata } from "next";
import VerifyForm from "@/components/auth/verifyForm";
import { createClient } from "@/utils/supabase/server";

export const metadata: Metadata = { title: "Enter your sign-in code" };

/** Reads which second-step methods the person has set up, then shows the form for them. */
async function VerifyForSignedIn() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	const { data: profile } = user
		? await supabase.from("profiles").select("two_step_email").eq("id", user.id).maybeSingle()
		: { data: null };

	const available = {
		app: Boolean(
			user?.factors?.some((f) => f.factor_type === "totp" && f.status === "verified"),
		),
		email: Boolean(profile?.two_step_email),
	};
	return <VerifyForm available={available} />;
}

export default function VerifyPage() {
	return (
		<Suspense fallback={null}>
			<VerifyForSignedIn />
		</Suspense>
	);
}
