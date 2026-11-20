import { Suspense } from "react";
import type { Metadata } from "next";
import ForgotPasswordFlow from "@/components/auth/forgotPasswordFlow";

export const metadata: Metadata = { title: "Reset password" };

/**
 * One page, four states: ask for the link, "check your email", set a new
 * password (the emailed link lands here with ?token=...), and done.
 * The flow reads the token on the client, so the page itself stays static;
 * Suspense is what lets Next prerender around that client-side read.
 */
export default function ForgotPasswordPage() {
	return (
		<Suspense fallback={null}>
			<ForgotPasswordFlow />
		</Suspense>
	);
}
