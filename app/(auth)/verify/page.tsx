import { Suspense } from "react";
import type { Metadata } from "next";
import VerifyForm from "@/components/auth/verifyForm";
import { currentSession } from "@/lib/currentSession";

export const metadata: Metadata = { title: "Enter your sign-in code" };

/** Reads which second-step methods the person can use, then shows the form for them. */
async function VerifyForSignedIn() {
	const session = await currentSession();
	return (
		<VerifyForm
			available={{ app: session?.hasApp ?? false, email: session?.hasEmail ?? false }}
		/>
	);
}

export default function VerifyPage() {
	return (
		<Suspense fallback={null}>
			<VerifyForSignedIn />
		</Suspense>
	);
}
