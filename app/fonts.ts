import localFont from "next/font/local";

// Helvetica Now Text — body, UI, inputs, table cells.
export const helveticaNowText = localFont({
	variable: "--font-helvetica-text",
	display: "swap",
	src: [
		{
			path: "../public/fonts/helveticaNowText/HelveticaNowText-Regular.woff2",
			weight: "400",
			style: "normal",
		},
		{
			path: "../public/fonts/helveticaNowText/HelveticaNowText-Medium.woff2",
			weight: "500",
			style: "normal",
		},
		{
			path: "../public/fonts/helveticaNowText/HelveticaNowText-Bold.woff2",
			weight: "700",
			style: "normal",
		},
	],
});

// Helvetica Now Display — h1, h2, grand totals.
export const helveticaNowDisplay = localFont({
	variable: "--font-helvetica-display",
	display: "swap",
	src: [
		{
			path: "../public/fonts/helveticaNowDisplay/HelveticaNowDisplay-Medium.woff2",
			weight: "500",
			style: "normal",
		},
		{
			path: "../public/fonts/helveticaNowDisplay/HelveticaNowDisplay-Bold.woff2",
			weight: "700",
			style: "normal",
		},
	],
});

// Nordique Pro — wordmark only. The logo ships as an image; avoid re-setting "Majeurs" in type.
export const nordiquePro = localFont({
	variable: "--font-nordique",
	display: "swap",
	src: [{ path: "../public/fonts/nordique-pro-regular.woff", weight: "400", style: "normal" }],
});
