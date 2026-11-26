import { Suspense } from "react";
import type { Metadata } from "next";
import WelcomeFlow from "@/components/auth/welcomeFlow";
import { currentSession } from "@/lib/currentSession";

export const metadata: Metadata = { title: "Set up your account" };

/** After an invite link: set a password, then see how two-step works. */
async function WelcomeForSignedIn() {
	const session = await currentSession();
	return (
		<WelcomeFlow email={session?.email ?? ""} needsPassword={session?.needsPassword ?? false} />
	);
}

export default function WelcomePage() {
	return (
		<Suspense fallback={null}>
			<WelcomeForSignedIn />
		</Suspense>
	);
}
