import type { Metadata } from "next";
import ForgotPasswordFlow from "@/components/auth/forgotPasswordFlow";

export const metadata: Metadata = { title: "Reset password" };

/**
 * One page, four states: ask for the link, "check your email", set a new
 * password (the emailed link lands here with ?token=...), and done.
 */
export default async function ForgotPasswordPage({
	searchParams,
}: {
	searchParams: Promise<{ token?: string | string[] }>;
}) {
	const { token } = await searchParams;
	return <ForgotPasswordFlow token={typeof token === "string" ? token : undefined} />;
}
