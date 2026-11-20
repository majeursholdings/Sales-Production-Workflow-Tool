"use client";

import {
	createContext,
	useCallback,
	useContext,
	useSyncExternalStore,
	type ReactNode,
} from "react";

export type Theme = "light" | "dark" | "system";
export const THEME_STORAGE_KEY = "majeurs-theme";

/**
 * Runs before hydration (inline in <head>) so there is no flash of the wrong theme.
 * Only an explicit "light"/"dark" sets data-theme; "system" leaves it unset and the
 * prefers-color-scheme rule in globals.css does the work.
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}})()`;

// --- external store: localStorage preference + OS colour scheme -------------
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function subscribe(listener: () => void) {
	listeners.add(listener);
	const mq = window.matchMedia("(prefers-color-scheme: dark)");
	mq.addEventListener("change", listener);
	window.addEventListener("storage", listener);
	return () => {
		listeners.delete(listener);
		mq.removeEventListener("change", listener);
		window.removeEventListener("storage", listener);
	};
}

function getTheme(): Theme {
	try {
		const v = localStorage.getItem(THEME_STORAGE_KEY);
		if (v === "light" || v === "dark") return v;
	} catch {}
	return "system";
}

const getSystemDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;

// --- context ----------------------------------------------------------------
type ThemeContextValue = {
	theme: Theme;
	resolvedTheme: "light" | "dark";
	setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
	const theme = useSyncExternalStore(subscribe, getTheme, () => "system" as Theme);
	const systemDark = useSyncExternalStore(subscribe, getSystemDark, () => false);
	const resolvedTheme = theme === "system" ? (systemDark ? "dark" : "light") : theme;

	const setTheme = useCallback((next: Theme) => {
		try {
			if (next === "system") localStorage.removeItem(THEME_STORAGE_KEY);
			else localStorage.setItem(THEME_STORAGE_KEY, next);
		} catch {}
		if (next === "system") delete document.documentElement.dataset.theme;
		else document.documentElement.dataset.theme = next;
		emit();
	}, []);

	return (
		<ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
			{children}
		</ThemeContext.Provider>
	);
}

export function useTheme() {
	const ctx = useContext(ThemeContext);
	if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
	return ctx;
}
