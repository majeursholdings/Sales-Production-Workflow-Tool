import type { Metadata } from "next";
import { helveticaNowDisplay, helveticaNowText, nordiquePro } from "./fonts";
import { ThemeProvider, themeInitScript } from "@/providers/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
	title: "Majeurs Inhouse Quote Generator Tool",
	description: "A tool to generate quotes for Majeurs Inhouse projects.",
	// Internal tool: keep out of every search index.
	robots: {
		index: false,
		follow: false,
		nocache: true,
		googleBot: { index: false, follow: false, noimageindex: true },
	},
};

export default function RootLayout({ children }: LayoutProps<"/">) {
	return (
		<html
			lang="en"
			suppressHydrationWarning
			className={`${helveticaNowText.variable} ${helveticaNowDisplay.variable} ${nordiquePro.variable} h-full antialiased`}
		>
			<head>
				<script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
			</head>
			<body className="flex min-h-full flex-col bg-page font-sans text-fg">
				<ThemeProvider>
					<main>{children}</main>
				</ThemeProvider>
			</body>
		</html>
	);
}
