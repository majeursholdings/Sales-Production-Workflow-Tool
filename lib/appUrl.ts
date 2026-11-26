import { requestInfo } from "@/utils/supabase/server";

/**
 * The app's public address, for links in emails. Never taken from the request
 * in production: a forged Host header could otherwise point a reset or invite
 * link at someone else's site. Set APP_URL (e.g. https://quotes.majeursholdings.com).
 */
export async function appUrl(): Promise<string> {
	const configured = process.env.APP_URL?.trim().replace(/\/+$/, "");
	if (configured) return configured;
	if (process.env.NODE_ENV === "production") {
		throw new Error("Set APP_URL in the server environment so email links point at the app.");
	}
	return (await requestInfo()).origin;
}
